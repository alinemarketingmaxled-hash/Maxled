import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { prisma } from "@/lib/prisma";
import { getMessageForSession } from "@/lib/erp/mail";
import { associationOptions } from "@/lib/erp/mail-options";
import { getCompanyContext } from "@/lib/erp/company";
import { FOLDER_LABELS, fmtBytes, type MailFolder } from "@/lib/erp/mail-utils";
import { fmtDateTime, orderCode } from "@/lib/erp/format";
import { Card, Badge, Field, PageHeader, btnPrimary, btnSecondary, btnDanger, inputCls } from "@/components/erp/ui";
import { ActionForm, ActionButton } from "@/components/erp/ActionForm";
import { associateAction, deleteDraftAction } from "../actions";

type AttachmentMeta = { filename: string; size: number; contentType?: string };

export default async function EmailMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("emails");
  const { id } = await params;
  const msg = await getMessageForSession(session, id);
  if (!msg) notFound();

  if (!msg.seen) await prisma.mailMessage.update({ where: { id: msg.id }, data: { seen: true } });

  const companyId = await getCompanyContext(session).then((c) => c.active.id).catch(() => null);
  const options = await associationOptions(session, companyId);
  const attachments = (Array.isArray(msg.attachments) ? msg.attachments : []) as AttachmentMeta[];
  const contactName = msg.contact ? msg.contact.accountName || `${msg.contact.firstName} ${msg.contact.lastName}` : null;

  return (
    <div>
      <PageHeader
        title={msg.subject}
        subtitle={
          <Link href={`/emails?conta=${msg.account.id}&pasta=${msg.folder}`} className="hover:text-gold">
            {msg.account.emailAddress} · {FOLDER_LABELS[msg.folder as MailFolder] ?? msg.folder}
          </Link>
        }
        actions={
          msg.folder === "DRAFTS" ? (
            <>
              <Link href={`/emails/novo?rascunho=${msg.id}`} className={btnPrimary}>
                Editar rascunho
              </Link>
              <ActionButton action={deleteDraftAction} fields={{ messageId: msg.id }} confirm="Excluir este rascunho?" className={btnDanger}>
                Excluir
              </ActionButton>
            </>
          ) : (
            <>
              <Link href={`/emails/novo?responder=${msg.id}`} className={btnPrimary}>
                Responder
              </Link>
              <Link href={`/emails/novo?encaminhar=${msg.id}`} className={btnSecondary}>
                Encaminhar
              </Link>
            </>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <dl className="mb-3 grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-[12.5px]">
            <dt className="text-ink-faint">De</dt>
            <dd className="break-all text-ink">{msg.fromAddr}</dd>
            <dt className="text-ink-faint">Para</dt>
            <dd className="break-all text-ink">{msg.toAddrs || "-"}</dd>
            {msg.ccAddrs && (
              <>
                <dt className="text-ink-faint">Cc</dt>
                <dd className="break-all text-ink">{msg.ccAddrs}</dd>
              </>
            )}
            <dt className="text-ink-faint">Data</dt>
            <dd className="text-ink">{fmtDateTime(msg.date)}</dd>
          </dl>
          {msg.sendError && (
            <p role="alert" className="mb-3 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
              Falha no envio: {msg.sendError}
            </p>
          )}
          {/* Só texto: HTML de e-mails externos nunca é renderizado. */}
          <div className="whitespace-pre-wrap break-words border-t border-gold-deep/20 pt-3 text-[13.5px] leading-relaxed text-ink">
            {msg.bodyText || "(mensagem sem texto)"}
          </div>
          {attachments.length > 0 && (
            <div className="mt-4 border-t border-gold-deep/20 pt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold">Anexos</p>
              <ul className="flex flex-col gap-1 text-[12.5px] text-ink">
                {attachments.map((a, i) => (
                  <li key={i}>
                    {a.filename} <span className="text-ink-faint">({fmtBytes(a.size)})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-ink-faint">Os arquivos ficam no servidor de e-mail; o ERP guarda só a referência.</p>
            </div>
          )}
        </Card>

        <Card title="Vínculos">
          <div className="mb-3 flex flex-col gap-1.5 text-[12.5px]">
            {contactName ? (
              <span>
                Cliente: <Badge tone="gold">{contactName}</Badge>
              </span>
            ) : (
              <span className="text-ink-faint">Sem cliente associado.</span>
            )}
            {msg.order ? (
              <span>
                Pedido:{" "}
                <Link href={`/pedidos/${msg.order.id}`} className="font-semibold text-gold underline">
                  {orderCode(msg.order.company.code, msg.order.number)}
                </Link>
              </span>
            ) : (
              <span className="text-ink-faint">Sem pedido associado.</span>
            )}
          </div>
          {(options.contacts.length > 0 || options.orders.length > 0) && (
            <ActionForm action={associateAction} className="flex flex-col gap-2">
              <input type="hidden" name="messageId" value={msg.id} />
              <Field label="Cliente">
                <select name="contactId" defaultValue={msg.contactId ?? ""} className={inputCls}>
                  <option value="">Nenhum</option>
                  {options.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pedido (empresa ativa)">
                <select name="orderId" defaultValue={msg.orderId ?? ""} className={inputCls}>
                  <option value="">Nenhum</option>
                  {options.orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <button className={btnSecondary}>Salvar vínculos</button>
            </ActionForm>
          )}
        </Card>
      </div>
    </div>
  );
}
