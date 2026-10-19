import { notFound, redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit, canEditCosts, canEditPrices, canSeeCosts } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCompanyContext } from "@/lib/erp/company";
import { productFormOptions } from "@/lib/erp/products";
import { PageHeader, NoCompany } from "@/components/erp/ui";
import { ProductForm } from "@/components/erp/produtos/ProductForm";
import { BackLink } from "@/components/shell/BackLink";
import { saveProductAction } from "../../actions";

const s = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? "" : v.toString());

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("produtos");
  const { id } = await params;
  if (!canEdit(session.user.role, "produtos")) redirect(`/produtos/${id}`);
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const p = await prisma.product.findFirst({
    where: { id, companyId: ctx.active.id, deletedAt: null },
    include: {
      components: { include: { component: { select: { sku: true } } } },
      suppliers: true,
    },
  });
  if (!p) notFound();
  const options = await productFormOptions(ctx.active.id, p.id);
  const role = session.user.role;
  const seeCosts = canSeeCosts(role);

  return (
    <div>
      <BackLink href={`/produtos/${p.id}`} label={p.sku} />
      <PageHeader title={`Editar ${p.sku}`} subtitle={p.name} />
      <ProductForm
        action={saveProductAction}
        {...options}
        canEditPrices={canEditPrices(role)}
        canEditCosts={canEditCosts(role)}
        canSeeCosts={seeCosts}
        values={{
          id: p.id,
          sku: p.sku,
          barcode: s(p.barcode),
          manufacturerCode: s(p.manufacturerCode),
          name: p.name,
          description: s(p.description),
          technicalSpecs: s(p.technicalSpecs),
          family: p.family,
          category: s(p.category),
          brand: s(p.brand),
          unit: p.unit,
          kind: p.kind,
          packQty: p.packQty,
          ncm: s(p.ncm),
          cest: s(p.cest),
          origin: p.origin,
          price: s(p.price),
          minPrice: s(p.minPrice),
          // Custo nunca vai ao navegador de quem não pode vê-lo.
          cost: seeCosts ? s(p.cost) : "",
          minStock: p.minStock,
          reorderQty: s(p.reorderQty),
          weightKg: s(p.weightKg),
          lengthCm: s(p.lengthCm),
          widthCm: s(p.widthCm),
          heightCm: s(p.heightCm),
          imageUrl: s(p.imageUrl),
          datasheetUrl: s(p.datasheetUrl),
          active: p.active,
          kit: p.components.map((c) => ({ sku: c.component.sku, quantity: c.quantity })),
          suppliers: p.suppliers.map((x) => ({
            supplierId: x.supplierId,
            supplierSku: s(x.supplierSku),
            lastCost: seeCosts ? s(x.lastCost) : "",
            leadTimeDays: s(x.leadTimeDays),
          })),
        }}
      />
    </div>
  );
}
