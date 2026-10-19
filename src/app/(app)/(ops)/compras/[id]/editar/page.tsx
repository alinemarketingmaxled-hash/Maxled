import { notFound, redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit, canSeeCosts } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { prisma } from "@/lib/prisma";
import { toDateInput } from "@/lib/erp/format";
import { PageHeader, Card, NoCompany } from "@/components/erp/ui";
import { PurchaseForm } from "@/components/erp/compras/PurchaseForm";
import { savePurchaseAction } from "../../actions";
import { purchaseFormOptions } from "../../form-data";

export default async function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("compras");
  if (!canEdit(session.user.role, "compras")) redirect("/compras");
  let companyId: string;
  try {
    companyId = (await getCompanyContext(session)).active.id;
  } catch {
    return <NoCompany />;
  }
  const { id } = await params;
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId }, include: { items: true } });
  if (!po) notFound();
  if (po.status !== "SOLICITADO" && po.status !== "COTACAO") redirect(`/compras/${po.id}`);
  const { products, suppliers } = await purchaseFormOptions(companyId, canSeeCosts(session.user.role));
  return (
    <div>
      <PageHeader title={`Editar compra #${po.number}`} />
      <Card>
        <PurchaseForm
          action={savePurchaseAction}
          products={products}
          suppliers={suppliers}
          initial={{
            id: po.id,
            supplierId: po.supplierId,
            isImport: po.isImport,
            currency: po.currency,
            exchangeRate: Number(po.exchangeRate),
            freight: Number(po.freight),
            insurance: Number(po.insurance),
            customsExpenses: Number(po.customsExpenses),
            importTaxes: Number(po.importTaxes),
            otherExpenses: Number(po.otherExpenses),
            costAllocation: po.costAllocation,
            installments: po.installments,
            firstDueDays: po.firstDueDays,
            intervalDays: po.intervalDays,
            expectedAt: toDateInput(po.expectedAt),
            quoteNotes: po.quoteNotes,
            notes: po.notes,
            items: po.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCostForeign: Number(i.unitCostForeign) })),
          }}
        />
      </Card>
    </div>
  );
}
