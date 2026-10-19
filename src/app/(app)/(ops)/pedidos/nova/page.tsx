import { redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { loadQuoteFormData } from "@/lib/erp/order-queries";
import { PageHeader, NoCompany } from "@/components/erp/ui";
import { BackLink } from "@/components/shell/BackLink";
import { QuoteForm } from "@/components/erp/pedidos/QuoteForm";
import { saveQuoteAction } from "../actions";

export default async function NovaCotacaoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const session = await requireView("pedidos");
  if (!canEdit(session.user.role, "pedidos")) redirect("/pedidos");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const { cliente } = await searchParams;
  const data = await loadQuoteFormData(session, ctx.active.id);
  const preset = cliente ? data.contacts.find((c) => c.id === cliente) : undefined;

  return (
    <div>
      <BackLink href="/pedidos" label="Pedidos" />
      <PageHeader title="Nova cotação" subtitle={`${ctx.active.code} · ${ctx.active.tradeName || ctx.active.name}`} />
      <QuoteForm
        action={saveQuoteAction}
        contacts={data.contacts}
        products={data.products}
        sellers={data.sellers}
        ownScope={data.ownScope}
        initial={
          preset
            ? {
                contactId: preset.id, sellerId: "", paymentMethod: "", installments: 1, firstDueDays: 30, intervalDays: 30,
                discountTotal: 0, freight: 0, otherExpenses: 0, carrier: "", shippingMode: "", freightPayer: "",
                billingAddress: preset.billingAddress ?? "", shippingAddress: preset.shippingAddress ?? "",
                notes: "", internalNotes: "", validUntil: "", items: [],
              }
            : undefined
        }
      />
    </div>
  );
}
