import { redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { PageHeader, Card, btnPrimary } from "@/components/erp/ui";
import { ActionForm } from "@/components/erp/ActionForm";
import { SupplierFields } from "@/components/erp/compras/SupplierFields";
import { createSupplierAction } from "../actions";

export default async function NovoFornecedorPage() {
  const session = await requireView("compras");
  if (!canEdit(session.user.role, "compras")) redirect("/compras/fornecedores");
  return (
    <div>
      <PageHeader title="Novo fornecedor" />
      <Card>
        <ActionForm action={createSupplierAction}>
          <SupplierFields />
          <div className="mt-4"><button className={btnPrimary}>Salvar fornecedor</button></div>
        </ActionForm>
      </Card>
    </div>
  );
}
