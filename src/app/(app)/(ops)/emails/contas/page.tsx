import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { prisma } from "@/lib/prisma";
import { isMailAdmin, listAccessibleAccounts, listAllAccountsForAdmin } from "@/lib/erp/mail";
import { fmtDateTime } from "@/lib/erp/format";
import { Badge, Card, EmptyState, PageHeader, btnSecondary, inputCls } from "@/components/erp/ui";
import { ActionButton, ActionForm } from "@/components/erp/ActionForm";
import { AccountForm } from "@/components/erp/emails/AccountForm";
import { saveAccountAction, shareAccountAction, syncAction, testConnectionAction } from "../actions";

export default async function MailAccountsPage() {
  const session = await requireView("emails");
  const admin = isMailAdmin(session.user.role);
  const [mine, all, users] = await Promise.all([
    listAccessibleAccounts(session),
    listAllAccountsForAdmin(session),
    prisma.user.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const accessibleIds = new Set(mine.map((a) => a.id));
  // Admin vê a configuração de todas; os demais, as próprias e compartilhadas.
  const accounts = admin ? all : mine;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Caixas de e-mail"
        subtitle="Credenciais ficam cifradas no servidor e nunca são exibidas. Cada caixa só é lida pelo dono e por quem ele autorizar."
        actions={<Link href="/emails" className={btnSecondary}>Voltar</Link>}
      />

      {accounts.length === 0 && <EmptyState>Nenhuma caixa cadastrada.</EmptyState>}

      {accounts.map((a) => {
        const canConfigure = admin || a.ownerId === session.user.id;
        return (
          <Card
            key={a.id}
            title={
              <span className="flex flex-wrap items-center gap-2 normal-case tracking-normal">
                <span className="text-sm text-ink">{a.emailAddress}</span>
                <span className="text-[11px] font-normal text-ink-muted">de {a.owner.name}</span>
                {!a.active && <Badge tone="neutral">Inativa</Badge>}
                {a.lastSyncError ? <Badge tone="critical">Erro de sincronização</Badge> : a.lastSyncAt ? <Badge tone="good">Sincronizada</Badge> : null}
              </span>
            }
            actions={
              <div className="flex flex-wrap gap-2">
                {canConfigure && (
                  <ActionButton action={testConnectionAction} fields={{ accountId: a.id }} className={btnSecondary}>
                    Testar conexão
                  </ActionButton>
                )}
                {accessibleIds.has(a.id) && (
                  <ActionButton action={syncAction} fields={{ accountId: a.id }} className={btnSecondary}>
                    Sincronizar
                  </ActionButton>
                )}
              </div>
            }
          >
            <p className="mb-3 text-[12px] text-ink-muted">
              IMAP {a.imapHost}:{a.imapPort} · SMTP {a.smtpHost}:{a.smtpPort} · última sincronização {fmtDateTime(a.lastSyncAt)}
              {a.lastSyncError && <span className="block text-critical">{a.lastSyncError}</span>}
            </p>

            {canConfigure && (
              <>
                <details className="mb-3">
                  <summary className="cursor-pointer text-xs font-semibold text-gold">Editar configuração</summary>
                  <div className="mt-3">
                    <AccountForm
                      action={saveAccountAction}
                      owners={admin ? users : undefined}
                      account={{
                        id: a.id, ownerId: a.ownerId, emailAddress: a.emailAddress, displayName: a.displayName,
                        imapHost: a.imapHost, imapPort: a.imapPort, imapSecure: a.imapSecure,
                        smtpHost: a.smtpHost, smtpPort: a.smtpPort, smtpSecure: a.smtpSecure,
                        username: a.username, active: a.active,
                      }}
                    />
                  </div>
                </details>

                <div className="border-t border-gold-deep/20 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">Acesso compartilhado</p>
                  {a.shares.length === 0 ? (
                    <p className="mb-2 text-xs text-ink-faint">Somente o dono acessa esta caixa.</p>
                  ) : (
                    <ul className="mb-2 flex flex-wrap gap-2">
                      {a.shares.map((s) => (
                        <li key={s.userId} className="flex items-center gap-1.5 rounded-full border border-gold-deep/30 px-2.5 py-1 text-xs text-ink">
                          {s.user.name}
                          <ActionButton
                            action={shareAccountAction}
                            fields={{ accountId: a.id, userId: s.userId, share: "false" }}
                            confirm={`Remover o acesso de ${s.user.name}?`}
                            className="text-critical hover:underline"
                          >
                            remover
                          </ActionButton>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ActionForm action={shareAccountAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="accountId" value={a.id} />
                    <input type="hidden" name="share" value="true" />
                    <select name="userId" defaultValue="" className={`${inputCls} w-auto`}>
                      <option value="">Escolha um usuário</option>
                      {users
                        .filter((u) => u.id !== a.ownerId && !a.shares.some((s) => s.userId === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                    <button className={btnSecondary}>Autorizar acesso</button>
                  </ActionForm>
                </div>
              </>
            )}
            {!canConfigure && <p className="text-xs text-ink-faint">Caixa compartilhada com você por {a.owner.name}.</p>}
          </Card>
        );
      })}

      <Card title={admin ? "Nova caixa (para qualquer usuário)" : "Cadastrar minha caixa"}>
        <AccountForm action={saveAccountAction} owners={admin ? users : undefined} />
      </Card>
    </div>
  );
}
