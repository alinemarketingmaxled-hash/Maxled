import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { getOrderForSession } from "@/lib/erp/orders";
import { currentProposalToken, proposalExpiresAt, type PublicProposal } from "@/lib/erp/proposal";
import { appOrigin } from "@/lib/erp/public-url";
import { fmtDateTime, orderCode } from "@/lib/erp/format";
import { prisma } from "@/lib/prisma";
import { Badge, NoCompany, PageHeader, btnPrimary, btnSecondary } from "@/components/erp/ui";
import { ActionButton } from "@/components/erp/ActionForm";
import { BackLink } from "@/components/shell/BackLink";
import { ProposalDocument } from "@/components/erp/pedidos/ProposalDocument";
import { CopyButton, PrintButton } from "@/components/erp/pedidos/ProposalButtons";
import { createProposalLinkAction } from "../../actions";

export const metadata = { title: "Proposta comercial | MAX LED" };

export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("pedidos");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const { id } = await params;
  const scoped = await getOrderForSession(session, ctx.active.id, id);
  if (!scoped) notFound();

  // Mesmos campos que o cliente vê no link, para o vendedor conferir antes de enviar.
  const order = (await prisma.salesOrder.findUnique({
    where: { id: scoped.id },
    select: {
      id: true, number: true, status: true, createdAt: true, validUntil: true, proposalSentAt: true, proposalViewedAt: true,
      proposalAcceptedAt: true, proposalAcceptedBy: true, proposalTokenEnc: true, paymentMethod: true, installments: true,
      firstDueDays: true, intervalDays: true, itemsTotal: true, discountTotal: true, freight: true, otherExpenses: true, total: true,
      carrier: true, shippingMode: true, freightPayer: true, shippingAddress: true, notes: true,
      company: { select: { code: true, name: true, tradeName: true, cnpj: true, street: true, number: true, district: true, city: true, state: true, phone: true, email: true } },
      contact: { select: { accountName: true, firstName: true, lastName: true, cnpj: true, email: true, phone: true, mobile: true, city: true, state: true } },
      seller: { select: { name: true, email: true } },
      items: { orderBy: { position: "asc" }, select: { id: true, quantity: true, unitPrice: true, discountPct: true, subtotal: true, product: { select: { sku: true, name: true, unit: true, ncm: true } } } },
    },
  }))!;

  const token = currentProposalToken(order);
  const link = token ? `${await appOrigin()}/proposta/${token}` : null;
  const qr = link ? await QRCode.toDataURL(link, { margin: 1, width: 184 }) : null;
  const editable = canEdit(session.user.role, "pedidos");
  const code = orderCode(order.company.code, order.number);
  const customer = order.contact.accountName || `${order.contact.firstName} ${order.contact.lastName}`.trim();
  const phone = (order.contact.mobile || order.contact.phone || "").replace(/\D/g, "");
  const waText = link
    ? `Olá! Segue a proposta ${code} da MAX LED. Você pode ver e aprovar por aqui: ${link}`
    : "";
  const wa = link ? `https://wa.me/${phone ? (phone.startsWith("55") ? phone : `55${phone}`) : ""}?text=${encodeURIComponent(waText)}` : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <BackLink href={`/pedidos/${order.id}`} label={`Pedido ${code}`} />
        <PageHeader
          title={`Proposta ${code}`}
          subtitle={<>{customer} · confira como o cliente vai ver e envie o link de aprovação</>}
          actions={
            <>
              {order.proposalAcceptedAt ? (
                <Badge tone="good">Aprovada por {order.proposalAcceptedBy} em {fmtDateTime(order.proposalAcceptedAt)}</Badge>
              ) : order.proposalViewedAt ? (
                <Badge tone="info">Cliente abriu em {fmtDateTime(order.proposalViewedAt)}</Badge>
              ) : order.proposalSentAt ? (
                <Badge tone="warning">Link enviado, ainda não aberto</Badge>
              ) : null}
              <PrintButton className={btnSecondary} />
              {editable && order.status === "COTACAO" && !order.proposalAcceptedAt && (
                <ActionButton
                  action={createProposalLinkAction}
                  fields={{ orderId: order.id }}
                  className={link ? btnSecondary : btnPrimary}
                  confirm={link ? "Gerar um novo link? O link enviado antes deixa de funcionar." : undefined}
                >
                  {link ? "Gerar novo link" : "Gerar link de aprovação"}
                </ActionButton>
              )}
            </>
          }
        />
        {link && !order.proposalAcceptedAt && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gold-deep/30 bg-surface px-3 py-2">
            <input readOnly value={link} aria-label="Link de aprovação" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink outline-none" />
            <CopyButton text={link} className={btnSecondary} />
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                Enviar por WhatsApp
              </a>
            )}
          </div>
        )}
        {order.status !== "COTACAO" && !order.proposalAcceptedAt && (
          <p className="mt-3 text-xs text-ink-muted">O pedido já saiu de cotação: a proposta serve só para consulta e impressão.</p>
        )}
      </div>
      <ProposalDocument order={order as unknown as PublicProposal} expiresAt={proposalExpiresAt(order)} link={order.proposalAcceptedAt ? null : link} qrDataUrl={qr} />
    </div>
  );
}
