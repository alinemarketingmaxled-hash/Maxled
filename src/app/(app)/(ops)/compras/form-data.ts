import "server-only";
import { prisma } from "@/lib/prisma";

/** Opções do formulário de compra: só produtos simples (kits não são
 * comprados) e fornecedores ativos da empresa ativa. */
export async function purchaseFormOptions(companyId: string, showCosts: boolean) {
  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, deletedAt: null, components: { none: {} } },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, cost: true },
    }),
    prisma.supplier.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currency: true, country: true },
    }),
  ]);
  return {
    products: products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, cost: showCosts ? Number(p.cost) : null })),
    suppliers,
  };
}
