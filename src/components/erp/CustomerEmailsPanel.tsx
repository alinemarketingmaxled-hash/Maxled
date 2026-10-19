import Link from "next/link";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { canView } from "@/lib/permissions";
import { accessibleAccountIds } from "@/lib/erp/mail";
import { fmtDateTime } from "@/lib/erp/format";
import { Card, btnSecondary } from "@/components/erp/ui";

/** E-mails ligados a um cliente ou pedido (§4.13). Só lista mensagens de
 * caixas que o visitante pode ler (próprias ou compartilhadas), então é
 * seguro em qualquer tela: quem não tem caixa autorizada vê só o aviso. */
export async function CustomerEmailsPanel({
  session,
  contactId,
  orderId,
}: {
  session: Session;
  contactId?: string | null;
  orderId?: string | null;
}) {
  if (!canView(session.user.role, "emails") || (!contactId && !orderId)) return null;
  const accountIds = await accessibleAccountIds(session);
  const messages =
    accountIds.length === 0
      ? []
      : await prisma.mailMessage.findMany({
          where: {
            accountId: { in: accountIds },
            folder: { in: ["INBOX", "SENT"] },
            ...(orderId ? { orderId } : { contactId: contactId! }),
          },
          orderBy: { date: "desc" },
          take: 20,
          select: { id: true, folder: true, fromAddr: true, toAddrs: true, subject: true, date: true, seen: true },
        });

  const newHref = `/emails/novo?${orderId ? `orderId=${orderId}` : `contactId=${contactId}`}`;

  return (
    <Card
      title="E-mails"
      actions={
        accountIds.length > 0 ? (
          <Link href={newHref} className={btnSecondary}>
            Novo e-mail
          </Link>
        ) : undefined
      }
    >
      {accountIds.length === 0 ? (
        <p className="text-xs text-ink-faint">Você não tem caixa de e-mail configurada ou compartilhada.</p>
      ) : messages.length === 0 ? (
        <p className="text-xs text-ink-faint">Nenhum e-mail associado nas caixas que você acessa.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gold-deep/20">
          {messages.map((m) => (
            <li key={m.id}>
              <Link href={`/emails/${m.id}`} className="flex flex-col gap-0.5 py-2 hover:text-gold sm:flex-row sm:items-center sm:gap-3">
                <span className="w-16 flex-none text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                  {m.folder === "SENT" ? "Enviado" : "Recebido"}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${m.seen ? "text-ink" : "font-bold text-ink"}`}>{m.subject}</span>
                <span className="truncate text-[11.5px] text-ink-muted sm:max-w-[30%]">{m.folder === "SENT" ? m.toAddrs : m.fromAddr}</span>
                <span className="flex-none text-[11.5px] tabular-nums text-ink-faint">{fmtDateTime(m.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
