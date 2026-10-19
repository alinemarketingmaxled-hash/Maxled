import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { requireView } from "@/lib/require-permission";
import { prisma } from "@/lib/prisma";
import { listAccessibleAccounts } from "@/lib/erp/mail";
import { FOLDER_LABELS, MAIL_FOLDERS, type MailFolder } from "@/lib/erp/mail-utils";
import { fmtDateTime } from "@/lib/erp/format";
import { PageHeader, EmptyState, Tabs, Badge, btnPrimary, btnSecondary, inputCls } from "@/components/erp/ui";
import { ActionButton } from "@/components/erp/ActionForm";
import { PaperclipIcon } from "@/components/shared/Icons";
import { syncAction } from "./actions";

const PAGE_SIZE = 50;

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; pasta?: string; q?: string; pagina?: string }>;
}) {
  const session = await requireView("emails");
  const params = await searchParams;
  const accounts = await listAccessibleAccounts(session);

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="E-mails" subtitle="Caixas individuais no domínio da empresa (IMAP/SMTP)." />
        <EmptyState>
          Nenhuma caixa de e-mail configurada para você.{" "}
          <Link href="/emails/contas" className="font-semibold text-gold underline">
            Cadastrar caixa
          </Link>
        </EmptyState>
      </div>
    );
  }

  const account = accounts.find((a) => a.id === params.conta) ?? accounts[0];
  const folder: MailFolder = (MAIL_FOLDERS as readonly string[]).includes(params.pasta ?? "") ? (params.pasta as MailFolder) : "INBOX";
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.pagina) || 1);

  const where: Prisma.MailMessageWhereInput = {
    accountId: account.id,
    folder,
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: "insensitive" } },
            { fromAddr: { contains: q, mode: "insensitive" } },
            { toAddrs: { contains: q, mode: "insensitive" } },
            { bodyText: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [messages, total, unread] = await Promise.all([
    prisma.mailMessage.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, fromAddr: true, toAddrs: true, subject: true, date: true, seen: true, attachments: true, sendError: true,
        contact: { select: { firstName: true, lastName: true, accountName: true } },
      },
    }),
    prisma.mailMessage.count({ where }),
    prisma.mailMessage.count({ where: { accountId: account.id, folder: "INBOX", seen: false } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { conta: account.id, pasta: folder, q: q || undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/emails?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="E-mails"
        subtitle={
          <>
            {account.emailAddress}
            {account.lastSyncAt && <> · sincronizado em {fmtDateTime(account.lastSyncAt)}</>}
          </>
        }
        actions={
          <>
            <ActionButton action={syncAction} fields={{ accountId: account.id }} className={btnSecondary}>
              Sincronizar
            </ActionButton>
            <Link href={`/emails/novo?conta=${account.id}`} className={btnPrimary}>
              Novo e-mail
            </Link>
            <Link href="/emails/contas" className={btnSecondary}>
              Contas
            </Link>
          </>
        }
      />

      {account.lastSyncError && (
        <p role="alert" className="mb-3 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
          Última sincronização falhou: {account.lastSyncError}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-2">
        {accounts.length > 1 && (
          <form action="/emails" className="flex items-end gap-2">
            <select name="conta" defaultValue={account.id} className={`${inputCls} w-auto`}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emailAddress}
                  {a.ownerId !== session.user.id ? ` (de ${a.owner.name})` : ""}
                </option>
              ))}
            </select>
            <button className={btnSecondary}>Abrir</button>
          </form>
        )}
        <form action="/emails" className="flex flex-1 items-end gap-2">
          <input type="hidden" name="conta" value={account.id} />
          <input type="hidden" name="pasta" value={folder} />
          <input name="q" defaultValue={q} placeholder="Pesquisar assunto, remetente, destinatário ou texto" className={`${inputCls} min-w-0 flex-1`} />
          <button className={btnSecondary}>Pesquisar</button>
        </form>
      </div>

      <Tabs
        active={folder}
        tabs={MAIL_FOLDERS.map((f) => ({
          key: f,
          label: FOLDER_LABELS[f],
          href: `/emails?conta=${account.id}&pasta=${f}`,
          count: f === "INBOX" && unread > 0 ? unread : undefined,
        }))}
      />

      {messages.length === 0 ? (
        <EmptyState>{q ? "Nenhuma mensagem encontrada." : "Pasta vazia."}</EmptyState>
      ) : (
        <ul className="divide-y divide-gold-deep/20 overflow-hidden rounded-xl border border-gold-deep/25 bg-surface">
          {messages.map((m) => {
            const who = folder === "INBOX" ? m.fromAddr : `Para: ${m.toAddrs}`;
            const contactName = m.contact ? m.contact.accountName || `${m.contact.firstName} ${m.contact.lastName}` : null;
            return (
              <li key={m.id}>
                <Link
                  href={folder === "DRAFTS" ? `/emails/novo?rascunho=${m.id}` : `/emails/${m.id}`}
                  className="flex flex-col gap-0.5 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className={`truncate text-[13px] sm:w-56 sm:flex-none ${m.seen ? "text-ink-muted" : "font-bold text-ink"}`}>{who}</span>
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${m.seen ? "text-ink" : "font-bold text-ink"}`}>
                    {m.subject}
                  </span>
                  <span className="flex flex-none items-center gap-2 text-[11.5px] text-ink-faint">
                    {m.sendError && <Badge tone="critical">Falha no envio</Badge>}
                    {contactName && <Badge tone="gold">{contactName}</Badge>}
                    {Array.isArray(m.attachments) && m.attachments.length > 0 && <PaperclipIcon className="h-3.5 w-3.5" />}
                    <span className="tabular-nums">{fmtDateTime(m.date)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-ink-muted">
          {page > 1 && (
            <Link href={qs({ pagina: page - 1 })} className={btnSecondary}>
              Anterior
            </Link>
          )}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages && (
            <Link href={qs({ pagina: page + 1 })} className={btnSecondary}>
              Próxima
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
