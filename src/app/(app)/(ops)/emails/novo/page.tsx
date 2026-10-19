import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { prisma } from "@/lib/prisma";
import { getMessageForSession, listAccessibleAccounts } from "@/lib/erp/mail";
import { associationOptions } from "@/lib/erp/mail-options";
import { getCompanyContext } from "@/lib/erp/company";
import { quoteBody, replySubject } from "@/lib/erp/mail-utils";
import { orderCode } from "@/lib/erp/format";
import { Card, EmptyState, PageHeader, btnSecondary } from "@/components/erp/ui";
import { ComposeForm, type ComposeDefaults } from "@/components/erp/emails/ComposeForm";
import { composeAction } from "../actions";

export default async function NewEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; contactId?: string; orderId?: string; responder?: string; encaminhar?: string; rascunho?: string }>;
}) {
  const session = await requireView("emails");
  const params = await searchParams;
  const accounts = (await listAccessibleAccounts(session)).filter((a) => a.active);
  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Novo e-mail" />
        <EmptyState>
          Nenhuma caixa ativa disponível.{" "}
          <Link href="/emails/contas" className="font-semibold text-gold underline">
            Cadastrar caixa
          </Link>
        </EmptyState>
      </div>
    );
  }

  const companyId = await getCompanyContext(session).then((c) => c.active.id).catch(() => null);
  const options = await associationOptions(session, companyId);

  const defaults: ComposeDefaults = {
    accountId: accounts.find((a) => a.id === params.conta)?.id ?? accounts[0].id,
    to: "",
    cc: "",
    subject: "",
    body: "",
    contactId: options.contacts.some((c) => c.id === params.contactId) ? params.contactId! : "",
    orderId: options.orders.some((o) => o.id === params.orderId) ? params.orderId! : "",
    inReplyTo: "",
    draftId: "",
  };
  let title = "Novo e-mail";

  const baseId = params.rascunho ?? params.responder ?? params.encaminhar;
  const base = baseId ? await getMessageForSession(session, baseId) : null;
  if (base) {
    if (accounts.some((a) => a.id === base.account.id)) defaults.accountId = base.account.id;
    defaults.contactId = base.contactId && options.contacts.some((c) => c.id === base.contactId) ? base.contactId : defaults.contactId;
    defaults.orderId = base.orderId && options.orders.some((o) => o.id === base.orderId) ? base.orderId : defaults.orderId;
    if (params.rascunho && base.folder === "DRAFTS") {
      title = "Editar rascunho";
      Object.assign(defaults, { to: base.toAddrs, cc: base.ccAddrs ?? "", subject: base.subject, body: base.bodyText, inReplyTo: base.inReplyTo ?? "", draftId: base.id });
    } else if (params.responder) {
      title = "Responder";
      Object.assign(defaults, {
        to: base.folder === "SENT" ? base.toAddrs : base.fromAddr,
        subject: replySubject(base.subject, "reply"),
        body: quoteBody(base.bodyText, base.fromAddr, base.date),
        inReplyTo: base.messageId ?? "",
      });
    } else if (params.encaminhar) {
      title = "Encaminhar";
      Object.assign(defaults, {
        subject: replySubject(base.subject, "forward"),
        body: `\n\n---------- Mensagem encaminhada ----------\nDe: ${base.fromAddr}\nPara: ${base.toAddrs}\nAssunto: ${base.subject}\n\n${base.bodyText}`,
      });
    }
  } else if (defaults.contactId || defaults.orderId) {
    // Aberto a partir de um cliente/pedido: preenche o e-mail comercial.
    const order = defaults.orderId
      ? await prisma.salesOrder.findUnique({ where: { id: defaults.orderId }, select: { number: true, contactId: true, company: { select: { code: true } } } })
      : null;
    const contactId = order?.contactId ?? defaults.contactId;
    const contact = contactId ? await prisma.contact.findUnique({ where: { id: contactId }, select: { email: true } }) : null;
    defaults.contactId = contactId || "";
    defaults.to = contact?.email ?? "";
    if (order) defaults.subject = `Pedido ${orderCode(order.company.code, order.number)}`;
  }

  return (
    <div>
      <PageHeader title={title} actions={<Link href="/emails" className={btnSecondary}>Voltar</Link>} />
      <Card>
        <ComposeForm
          action={composeAction}
          accounts={accounts.map((a) => ({ id: a.id, label: a.displayName ? `${a.displayName} <${a.emailAddress}>` : a.emailAddress }))}
          contacts={options.contacts}
          orders={options.orders}
          defaults={defaults}
        />
      </Card>
    </div>
  );
}
