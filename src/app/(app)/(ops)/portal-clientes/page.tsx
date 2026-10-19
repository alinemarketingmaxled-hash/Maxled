import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { REQUEST_TYPE_LABELS } from "@/lib/erp/portal-labels";
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, btnDanger, btnSecondary, tdCls, thCls } from "@/components/erp/ui";
import { ActionButton } from "@/components/erp/ActionForm";
import { CreateAccessForm } from "@/components/portal/CreateAccessForm";
import { RespondForm } from "@/components/portal/RespondForm";
import { fmtDateTime } from "@/lib/erp/format";
import {
  createPortalAccess,
  respondPortalRequest,
  resetPortalPassword,
  searchPortalContacts,
  togglePortalAccess,
  unlockPortalAccess,
} from "./actions";

export default async function PortalAdminPage({ searchParams }: { searchParams: Promise<{ aba?: string; status?: string }> }) {
  const session = await requireView("portalAdmin");
  const editable = canEdit(session.user.role, "portalAdmin");
  const { aba, status } = await searchParams;
  const tab = aba === "solicitacoes" ? "solicitacoes" : "acessos";
  const reqStatus = status === "RESOLVIDA" ? "RESOLVIDA" : "ABERTA";

  const [users, requests, openCount] = await Promise.all([
    tab === "acessos"
      ? prisma.portalUser.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, email: true, active: true, lockedAt: true, lastLoginAt: true, createdAt: true,
            contact: { select: { id: true, firstName: true, lastName: true, accountName: true, cnpj: true } },
          },
        })
      : Promise.resolve([]),
    tab === "solicitacoes"
      ? prisma.portalRequest.findMany({
          where: { status: reqStatus },
          orderBy: { createdAt: reqStatus === "ABERTA" ? "asc" : "desc" },
          take: 200,
          select: {
            id: true, type: true, message: true, response: true, createdAt: true, resolvedAt: true,
            portalUser: { select: { name: true, email: true } },
            contact: { select: { id: true, firstName: true, lastName: true, accountName: true } },
          },
        })
      : Promise.resolve([]),
    prisma.portalRequest.count({ where: { status: "ABERTA" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Portal do cliente"
        subtitle="Acessos externos dos clientes e solicitações enviadas pelo portal. Cada acesso enxerga só o próprio cadastro."
        actions={
          <Link href="/portal/login" target="_blank" className={btnSecondary}>
            Abrir tela de login do portal
          </Link>
        }
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "acessos", label: "Acessos", href: "/portal-clientes" },
          { key: "solicitacoes", label: "Solicitações", href: "/portal-clientes?aba=solicitacoes", count: openCount },
        ]}
      />

      {tab === "acessos" ? (
        <>
          {editable && (
            <Card title="Novo acesso">
              <CreateAccessForm action={createPortalAccess} search={searchPortalContacts} />
            </Card>
          )}
          {users.length === 0 ? (
            <EmptyState>Nenhum cliente com acesso ao portal.</EmptyState>
          ) : (
            <Table
              head={
                <>
                  <th className={thCls}>Cliente</th>
                  <th className={thCls}>Acesso</th>
                  <th className={thCls}>Situação</th>
                  <th className={thCls}>Último login</th>
                  {editable && <th className={thCls}>Ações</th>}
                </>
              }
            >
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={tdCls}>
                    <Link href={`/vendas?id=${u.contact.id}`} className="font-semibold text-ink hover:text-gold">
                      {u.contact.accountName || `${u.contact.firstName} ${u.contact.lastName}`}
                    </Link>
                    {u.contact.cnpj && <span className="block text-[11px] text-ink-faint">{u.contact.cnpj}</span>}
                  </td>
                  <td className={tdCls}>
                    {u.name}
                    <span className="block text-[11px] text-ink-muted">{u.email}</span>
                  </td>
                  <td className={tdCls}>
                    <span className="flex flex-wrap gap-1">
                      {u.active ? <Badge tone="good">Ativo</Badge> : <Badge>Inativo</Badge>}
                      {u.lockedAt && <Badge tone="critical">Bloqueado</Badge>}
                    </span>
                  </td>
                  <td className={tdCls}>{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Nunca"}</td>
                  {editable && (
                    <td className={tdCls}>
                      <div className="flex flex-wrap gap-1.5">
                        <ActionButton action={togglePortalAccess} fields={{ id: u.id }} className={u.active ? btnDanger : btnSecondary}
                          confirm={u.active ? `Desativar o acesso de ${u.email}?` : undefined}>
                          {u.active ? "Desativar" : "Reativar"}
                        </ActionButton>
                        {u.lockedAt && (
                          <ActionButton action={unlockPortalAccess} fields={{ id: u.id }} className={btnSecondary}>
                            Desbloquear
                          </ActionButton>
                        )}
                        <ActionButton action={resetPortalPassword} fields={{ id: u.id }} className={btnSecondary}
                          prompt={`Nova senha temporária para ${u.email} (mín. 8 caracteres):`}>
                          Redefinir senha
                        </ActionButton>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </Table>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-2 text-xs">
            <Link href="/portal-clientes?aba=solicitacoes&status=ABERTA" className={reqStatus === "ABERTA" ? "font-semibold text-gold" : "text-ink-muted hover:text-ink"}>
              Abertas
            </Link>
            <span className="text-ink-faint">|</span>
            <Link href="/portal-clientes?aba=solicitacoes&status=RESOLVIDA" className={reqStatus === "RESOLVIDA" ? "font-semibold text-gold" : "text-ink-muted hover:text-ink"}>
              Respondidas
            </Link>
          </div>
          {requests.length === 0 ? (
            <EmptyState>Nenhuma solicitação {reqStatus === "ABERTA" ? "aberta" : "respondida"}.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {requests.map((r) => (
                <Card
                  key={r.id}
                  title={REQUEST_TYPE_LABELS[r.type] ?? r.type}
                  actions={<span className="text-[11px] text-ink-faint">{fmtDateTime(r.createdAt)}</span>}
                >
                  <p className="text-xs text-ink-muted">
                    <Link href={`/vendas?id=${r.contact.id}`} className="font-semibold text-ink hover:text-gold">
                      {r.contact.accountName || `${r.contact.firstName} ${r.contact.lastName}`}
                    </Link>{" "}
                    · {r.portalUser.name} ({r.portalUser.email})
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink">{r.message}</p>
                  {r.response ? (
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-2 p-2 text-sm text-ink-muted">
                      <span className="block text-[10.5px] font-semibold uppercase text-gold">Resposta · {fmtDateTime(r.resolvedAt)}</span>
                      {r.response}
                    </p>
                  ) : (
                    editable && <RespondForm id={r.id} action={respondPortalRequest} />
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
