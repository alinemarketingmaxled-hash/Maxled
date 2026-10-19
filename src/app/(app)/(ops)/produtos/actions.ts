"use server";

import type { ProductKind } from "@/generated/prisma/client";
import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, num, int, bool, type ActionResult } from "@/lib/erp/action-result";
import { saveProduct, type ProductInput, type KitRow, type SupplierRow } from "@/lib/erp/products";

const KINDS: ProductKind[] = ["UNIDADE", "PACOTE", "CAIXA", "KIT"];

function readInput(fd: FormData): ProductInput {
  const kind = str(fd, "kind") as ProductKind | null;
  const kitSkus = fd.getAll("kitSku").map(String);
  const kitQtys = fd.getAll("kitQty").map(String);
  const kit: KitRow[] = kitSkus.map((sku, i) => ({ sku, quantity: Number(kitQtys[i] ?? 0) }));
  const supIds = fd.getAll("supId").map(String);
  const supSkus = fd.getAll("supSku").map(String);
  const supCosts = fd.getAll("supCost").map(String);
  const supLead = fd.getAll("supLead").map(String);
  const toNum = (v: string | undefined) => {
    if (!v || !v.trim()) return null;
    const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
    return Number.isFinite(n) ? n : null;
  };
  const suppliers: SupplierRow[] = supIds.map((supplierId, i) => ({
    supplierId,
    supplierSku: supSkus[i]?.trim() || null,
    lastCost: toNum(supCosts[i]),
    leadTimeDays: toNum(supLead[i]) === null ? null : Math.trunc(toNum(supLead[i])!),
  }));
  return {
    sku: str(fd, "sku") ?? "",
    barcode: str(fd, "barcode"),
    manufacturerCode: str(fd, "manufacturerCode"),
    name: str(fd, "name") ?? "",
    description: str(fd, "description"),
    technicalSpecs: str(fd, "technicalSpecs"),
    family: str(fd, "family") ?? "Outros",
    category: str(fd, "category"),
    brand: str(fd, "brand"),
    unit: str(fd, "unit") ?? "UN",
    kind: kind && KINDS.includes(kind) ? kind : "UNIDADE",
    packQty: int(fd, "packQty") ?? 1,
    ncm: str(fd, "ncm"),
    cest: str(fd, "cest"),
    origin: int(fd, "origin") ?? 0,
    price: num(fd, "price"),
    minPrice: num(fd, "minPrice"),
    cost: num(fd, "cost"),
    minStock: int(fd, "minStock") ?? 0,
    reorderQty: int(fd, "reorderQty"),
    weightKg: num(fd, "weightKg"),
    lengthCm: num(fd, "lengthCm"),
    widthCm: num(fd, "widthCm"),
    heightCm: num(fd, "heightCm"),
    imageUrl: str(fd, "imageUrl"),
    datasheetUrl: str(fd, "datasheetUrl"),
    active: bool(fd, "active"),
    kit,
    suppliers,
  };
}

export async function saveProductAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("produtos");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const id = str(fd, "id") ?? undefined;
    const product = await saveProduct(session, companyId, readInput(fd), id);
    return { ok: true, message: "Produto salvo.", redirectTo: `/produtos/${product.id}` };
  });
}
