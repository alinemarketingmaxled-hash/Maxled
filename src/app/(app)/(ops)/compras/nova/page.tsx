import { redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit, canSeeCosts } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { PageHeader, Card, NoCompany } from "@/components/erp/ui";
import { PurchaseForm } from "@/components/erp/compras/PurchaseForm";
import { savePurchaseAction } from "../actions";
import { purchaseFormOptions } from "../form-data";

export default async function NovaCompraPage() {
  const session = await requireView("compras");
  if (!canEdit(session.user.role, "compras")) redirect("/compras");
  let companyId: string;
  try {
    companyId = (await getCompanyContext(session)).active.id;
  } catch {
    return <NoCompany />;
  }
  const { products, suppliers } = await purchaseFormOptions(companyId, canSeeCosts(session.user.role));
  return (
    <div>
      <PageHeader title="Nova solicitação de compra" subtitle="Depois de registrada, a solicitação segue para cotação e aprovação da diretoria." />
      <Card>
        <PurchaseForm action={savePurchaseAction} products={products} suppliers={suppliers} />
      </Card>
    </div>
  );
}
