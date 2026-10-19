import { notFound, redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { getOrderForSession } from "@/lib/erp/orders";
import { loadQuoteFormData } from "@/lib/erp/order-queries";
import { orderCode, toDateInput } from "@/lib/erp/format";
import { PageHeader, NoCompany } from "@/components/erp/ui";
import { BackLink } from "@/components/shell/BackLink";
import { QuoteForm } from "@/components/erp/pedidos/QuoteForm";
import { saveQuoteAction } from "../../actions";

export default async function EditarCotacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("pedidos");
  const { id } = await params;
  if (!canEdit(session.user.role, "pedidos")) redirect(`/pedidos/${id}`);
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const order = await getOrderForSession(session, ctx.active.id, id);
  if (!order) notFound();
  if (order.status !== "COTACAO") redirect(`/pedidos/${id}`);
  const data = await loadQuoteFormData(session, ctx.active.id);

  // Cliente fora da carteira atual (ex.: carteira transferida) continua
  // aparecendo para a edição não perder o vínculo.
  const contacts = data.contacts.some((c) => c.id === order.contactId)
    ? data.contacts
    : [
        ...data.contacts,
        {
          id: order.contact.id,
          label: order.contact.accountName || `${order.contact.firstName} ${order.contact.lastName}`,
          person: `${order.contact.firstName} ${order.contact.lastName}`,
          cnpj: order.contact.cnpj,
          ownerId: order.contact.ownerId,
          billingAddress: null,
          shippingAddress: null,
        },
      ];

  return (
    <div>
      <BackLink href={`/pedidos/${id}`} label="Voltar ao pedido" />
      <PageHeader title={`Editar cotação ${orderCode(ctx.active.code, order.number)}`} />
      <QuoteForm
        action={saveQuoteAction}
        contacts={contacts}
        products={data.products}
        sellers={data.sellers}
        ownScope={data.ownScope}
        initial={{
          orderId: order.id,
          contactId: order.contactId,
          sellerId: order.sellerId,
          paymentMethod: order.paymentMethod ?? "",
          installments: order.installments,
          firstDueDays: order.firstDueDays,
          intervalDays: order.intervalDays,
          discountTotal: order.discountTotal.toNumber(),
          freight: order.freight.toNumber(),
          otherExpenses: order.otherExpenses.toNumber(),
          carrier: order.carrier ?? "",
          shippingMode: order.shippingMode ?? "",
          freightPayer: order.freightPayer ?? "",
          billingAddress: order.billingAddress ?? "",
          shippingAddress: order.shippingAddress ?? "",
          notes: order.notes ?? "",
          internalNotes: order.internalNotes ?? "",
          validUntil: toDateInput(order.validUntil),
          items: order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice.toNumber(),
            discountPct: i.discountPct.toNumber(),
          })),
        }}
      />
    </div>
  );
}
