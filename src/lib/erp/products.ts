import "server-only";
import type { Session } from "next-auth";
import { Prisma, type ProductKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit, canEditCosts, canEditPrices } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { D, round2 } from "@/lib/erp/money";

export class ProductError extends Error {}

export const PRODUCT_FAMILIES = ["LEDs", "Resistores", "Capacitores", "Diodos", "Relés", "Automação", "Módulos", "Outros"];

export const KIND_LABELS: Record<ProductKind, string> = {
  UNIDADE: "Unidade",
  PACOTE: "Pacote",
  CAIXA: "Caixa",
  KIT: "Kit comercial",
};

export const ORIGIN_LABELS: Record<number, string> = {
  0: "0 - Nacional",
  1: "1 - Estrangeira (importação direta)",
  2: "2 - Estrangeira (mercado interno)",
  3: "3 - Nacional, conteúdo importado 40% a 70%",
  4: "4 - Nacional, processos produtivos básicos",
  5: "5 - Nacional, conteúdo importado até 40%",
  6: "6 - Estrangeira direta, sem similar nacional",
  7: "7 - Estrangeira interna, sem similar nacional",
  8: "8 - Nacional, conteúdo importado acima de 70%",
};

export type ProductFilters = { q?: string; family?: string; status?: string };

export async function listProducts(companyId: string, f: ProductFilters) {
  const q = f.q?.trim();
  return prisma.product.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(f.family ? { family: f.family } : {}),
      ...(f.status === "inativos" ? { active: false } : f.status === "todos" ? {} : { active: true }),
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q } },
              { manufacturerCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ family: "asc" }, { sku: "asc" }],
    take: 500,
    include: { _count: { select: { components: true } } },
  });
}

export type KitRow = { sku: string; quantity: number };
export type SupplierRow = { supplierId: string; supplierSku: string | null; lastCost: number | null; leadTimeDays: number | null };

export type ProductInput = {
  sku: string;
  barcode: string | null;
  manufacturerCode: string | null;
  name: string;
  description: string | null;
  technicalSpecs: string | null;
  family: string;
  category: string | null;
  brand: string | null;
  unit: string;
  kind: ProductKind;
  packQty: number;
  ncm: string | null;
  cest: string | null;
  origin: number;
  price: number | null;
  minPrice: number | null;
  cost: number | null;
  minStock: number;
  reorderQty: number | null;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  imageUrl: string | null;
  datasheetUrl: string | null;
  active: boolean;
  kit: KitRow[];
  suppliers: SupplierRow[];
};

const decOrNull = (v: number | null) => (v === null ? null : D(v));
const sameDec = (a: Prisma.Decimal | null, b: Prisma.Decimal | null) =>
  a === null || b === null ? a === b : a.equals(b);

/** Cria/edita o produto. As regras de campo valem no servidor: quem não pode
 * mexer em preço/custo tem esses valores ignorados (mantém o gravado). */
export async function saveProduct(session: Session, companyId: string, input: ProductInput, productId?: string) {
  if (!canEdit(session.user.role, "produtos")) throw new ProductError("Sem permissão para editar produtos.");
  const sku = input.sku.trim().toUpperCase();
  if (!sku) throw new ProductError("Informe o SKU.");
  if (!input.name.trim()) throw new ProductError("Informe o nome.");
  if (input.ncm && input.ncm.replace(/\D/g, "").length !== 8) throw new ProductError("NCM deve ter 8 dígitos.");
  if (input.origin < 0 || input.origin > 8) throw new ProductError("Origem inválida.");
  for (const v of [input.price, input.minPrice, input.cost]) {
    if (v !== null && v < 0) throw new ProductError("Valores não podem ser negativos.");
  }
  const prices = canEditPrices(session.user.role);
  const costs = canEditCosts(session.user.role);

  return prisma.$transaction(async (tx) => {
    const existing = productId
      ? await tx.product.findFirst({ where: { id: productId, companyId, deletedAt: null } })
      : null;
    if (productId && !existing) throw new ProductError("Produto não encontrado.");

    // Componentes do kit: só produtos simples da mesma empresa.
    const kitRows = input.kit.filter((r) => r.sku.trim() && r.quantity > 0);
    const merged = new Map<string, number>();
    for (const r of kitRows) {
      if (!Number.isInteger(r.quantity)) throw new ProductError("Quantidade do componente deve ser inteira.");
      const k = r.sku.trim().toUpperCase();
      merged.set(k, (merged.get(k) ?? 0) + r.quantity);
    }
    const componentProducts = merged.size
      ? await tx.product.findMany({
          where: { companyId, deletedAt: null, sku: { in: [...merged.keys()] } },
          select: { id: true, sku: true, _count: { select: { components: true } } },
        })
      : [];
    for (const k of merged.keys()) {
      const c = componentProducts.find((p) => p.sku === k);
      if (!c) throw new ProductError(`Componente ${k} não encontrado nesta empresa.`);
      if (k === sku || c.id === productId) throw new ProductError("Um kit não pode conter ele mesmo.");
      if (c._count.components > 0) throw new ProductError(`${k} é um kit: componentes devem ser produtos simples.`);
    }
    if (merged.size > 0 && existing) {
      if (existing.stockPhysical > 0 || existing.stockReserved > 0 || existing.stockBlocked > 0) {
        throw new ProductError("Produto com saldo próprio não pode virar kit. Zere o saldo antes.");
      }
      const usedIn = await tx.kitComponent.count({ where: { componentId: existing.id } });
      if (usedIn > 0) throw new ProductError("Este produto é componente de outro kit e não pode ter componentes.");
    }

    const data = {
      sku,
      barcode: input.barcode,
      manufacturerCode: input.manufacturerCode,
      name: input.name.trim(),
      description: input.description,
      technicalSpecs: input.technicalSpecs,
      family: PRODUCT_FAMILIES.includes(input.family) ? input.family : "Outros",
      category: input.category,
      brand: input.brand,
      unit: input.unit || "UN",
      kind: input.kind,
      packQty: Math.max(1, input.packQty || 1),
      ncm: input.ncm ? input.ncm.replace(/\D/g, "") : null,
      cest: input.cest ? input.cest.replace(/\D/g, "") : null,
      origin: input.origin,
      minStock: Math.max(0, input.minStock),
      reorderQty: input.reorderQty,
      weightKg: decOrNull(input.weightKg),
      lengthCm: decOrNull(input.lengthCm),
      widthCm: decOrNull(input.widthCm),
      heightCm: decOrNull(input.heightCm),
      imageUrl: input.imageUrl,
      datasheetUrl: input.datasheetUrl,
      active: input.active,
      ...(prices ? { price: round2(input.price ?? 0), minPrice: input.minPrice === null ? null : round2(input.minPrice) } : {}),
      ...(costs ? { cost: D(input.cost ?? 0).toDecimalPlaces(4) } : {}),
    };

    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data })
      : await tx.product.create({ data: { ...data, companyId } });

    await tx.kitComponent.deleteMany({ where: { kitId: product.id } });
    if (merged.size > 0) {
      await tx.kitComponent.createMany({
        data: [...merged].map(([k, quantity]) => ({
          kitId: product.id,
          componentId: componentProducts.find((p) => p.sku === k)!.id,
          quantity,
        })),
      });
    }

    // Fornecedores vinculados (somente da mesma empresa).
    const supplierRows = input.suppliers.filter((s) => s.supplierId);
    const validSuppliers = supplierRows.length
      ? await tx.supplier.findMany({
          where: { companyId, deletedAt: null, id: { in: supplierRows.map((s) => s.supplierId) } },
          select: { id: true },
        })
      : [];
    const validIds = new Set(validSuppliers.map((s) => s.id));
    const previous = await tx.productSupplier.findMany({ where: { productId: product.id } });
    await tx.productSupplier.deleteMany({ where: { productId: product.id } });
    const seen = new Set<string>();
    for (const s of supplierRows) {
      if (!validIds.has(s.supplierId) || seen.has(s.supplierId)) continue;
      seen.add(s.supplierId);
      const prev = previous.find((p) => p.supplierId === s.supplierId);
      await tx.productSupplier.create({
        data: {
          productId: product.id,
          supplierId: s.supplierId,
          supplierSku: s.supplierSku,
          // Custo do fornecedor é valor financeiro: sem permissão mantém o anterior.
          lastCost: costs ? (s.lastCost === null ? null : D(s.lastCost).toDecimalPlaces(4)) : (prev?.lastCost ?? null),
          leadTimeDays: s.leadTimeDays,
        },
      });
    }

    const base = { actorId: session.user.id, entityType: "Product" as const, entityId: product.id, companyId };
    await logActivity({ ...base, action: existing ? "updated" : "created", diff: { sku } }, tx);
    if (existing) {
      const changes: Record<string, { de: string | null; para: string | null }> = {};
      const cmp = (key: "price" | "minPrice" | "cost") => {
        const before = existing[key];
        const after = product[key];
        if (!sameDec(before, after)) changes[key] = { de: before?.toString() ?? null, para: after?.toString() ?? null };
      };
      cmp("price");
      cmp("minPrice");
      cmp("cost");
      if (Object.keys(changes).length > 0) {
        await logActivity({ ...base, action: "price_changed", diff: changes }, tx);
      }
    }
    return product;
  });
}

export async function productFormOptions(companyId: string, excludeId?: string) {
  const [components, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, deletedAt: null, active: true, components: { none: {} }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { sku: true, name: true },
      orderBy: { sku: "asc" },
    }),
    prisma.supplier.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    componentOptions: components,
    supplierOptions: suppliers,
    families: PRODUCT_FAMILIES,
    kinds: (Object.keys(KIND_LABELS) as ProductKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] })),
    origins: Object.entries(ORIGIN_LABELS).map(([v, label]) => ({ value: Number(v), label })),
  };
}
