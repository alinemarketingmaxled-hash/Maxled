import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCompanyContext } from "@/lib/erp/company";
import { getMlStatus, listingAvailable, ML_PROVIDER } from "@/lib/erp/mercadolivre";
import { INTEGRATION_STATUS_LABELS } from "@/lib/erp/integrations";
import { MOVEMENT_LABELS } from "@/lib/erp/stock";
import { ORDER_STATUS_LABELS } from "@/lib/erp/orders";
import { fmtDateTime, fmtMoney, orderCode } from "@/lib/erp/format";
import { ActionButton, ActionForm } from "@/components/erp/ActionForm";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  NoCompany,
  PageHeader,
  Table,
  Tabs,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
  tdCls,
  thCls,
  type Tone,
} from "@/components/erp/ui";
import type { IntegrationStatus } from "@/generated/prisma/client";
import {
  connectAction,
  deleteListingAction,
  reprocessAction,
  saveConfigAction,
  saveListingAction,
  simulateOrderAction,
  syncAllListingsAction,
  syncListingAction,
} from "./actions";

const EVENT_TONE: Record<IntegrationStatus, Tone> = {
  PENDENTE: "info",
  PROCESSADO: "good",
  ERRO: "critical",
  IGNORADO: "neutral",
};

const STATUSES: IntegrationStatus[] = ["ERRO", "PENDENTE", "PROCESSADO", "IGNORADO"];

export default async function MercadoLivrePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; editar?: string; conectado?: string; erro?: string }>;
}) {
  const session = await requireView("mercadolivre");
  const params = await searchParams;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const companyId = ctx.active.id;
  const editable = canEdit(session.user.role, "mercadolivre");
  const statusFilter = STATUSES.includes(params.status as IntegrationStatus) ? (params.status as IntegrationStatus) : undefined;

  const [status, listings, products, sellers, mlOrders, events, statusCounts] = await Promise.all([
    getMlStatus(companyId),
    prisma.marketplaceListing.findMany({
      where: { companyId, channel: "MERCADO_LIVRE" },
      orderBy: [{ active: "desc" }, { title: "asc" }],
      include: { product: { select: { sku: true, name: true, _count: { select: { components: true } } } } },
    }),
    editable
      ? prisma.product.findMany({
          where: { companyId, deletedAt: null, active: true },
          orderBy: { sku: "asc" },
          select: { id: true, sku: true, name: true },
        })
      : Promise.resolve([]),
    editable
      ? prisma.user.findMany({
          where: {
            deletedAt: null,
            role: { not: "CUSTOMER" },
            OR: [{ role: "MEDIATOR" }, { companies: { some: { companyId } } }],
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.salesOrder.findMany({
      where: { companyId, channel: "MERCADO_LIVRE" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { contact: { select: { accountName: true, firstName: true } } },
    }),
    prisma.integrationEvent.findMany({
      where: { companyId, provider: ML_PROVIDER, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.integrationEvent.groupBy({
      by: ["status"],
      where: { companyId, provider: ML_PROVIDER },
      _count: { _all: true },
    }),
  ]);

  const availability = await listingAvailable(companyId, listings);
  const orderIds = mlOrders.map((o) => o.id);
  const orderById = new Map(mlOrders.map((o) => [o.id, o]));
  const movements = orderIds.length
    ? await prisma.stockMovement.findMany({
        where: { companyId, documentType: "SalesOrder", documentId: { in: orderIds } },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { product: { select: { sku: true, name: true } } },
      })
    : [];

  const editing = params.editar ? listings.find((l) => l.id === params.editar) : undefined;
  const countBy = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const totalEvents = statusCounts.reduce((s, c) => s + c._count._all, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Mercado Livre"
        subtitle={`Anúncios, pedidos, reservas e sincronização de estoque · Empresa ${ctx.active.code}`}
        actions={
          editable && listings.length > 0 ? (
            <ActionButton action={syncAllListingsAction} className={btnSecondary}>
              Sincronizar estoque de todos
            </ActionButton>
          ) : undefined
        }
      />

      {params.conectado && <p className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm text-good">Conta Mercado Livre conectada.</p>}
      {params.erro && <p className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">{params.erro}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Conexão">
          <div className="mb-3 flex flex-wrap gap-2">
            {status.connected ? <Badge tone="good">Conta conectada</Badge> : <Badge tone="warning">Conta não conectada</Badge>}
            {status.configured ? <Badge tone="gold">Aplicativo configurado</Badge> : <Badge>Aplicativo não configurado</Badge>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-ink-muted">Client ID</dt>
            <dd>{status.clientIdHint ?? "-"}</dd>
            <dt className="text-ink-muted">Client Secret</dt>
            <dd>{status.clientSecretHint ? `configurado (${status.clientSecretHint})` : "-"}</dd>
            <dt className="text-ink-muted">Usuário ML</dt>
            <dd>{status.sellerUserId ?? "-"}</dd>
            <dt className="text-ink-muted">Token expira</dt>
            <dd>{status.tokenExpiresAt ? fmtDateTime(status.tokenExpiresAt) : "-"} <span className="text-ink-faint">(renovado automaticamente)</span></dd>
            <dt className="text-ink-muted">Notificações</dt>
            <dd className="break-all text-ink-faint">/api/integrations/mercadolivre/webhook</dd>
          </dl>
          {editable && status.configured && (
            <form action={connectAction} className="mt-3">
              <button className={btnPrimary}>{status.connected ? "Reconectar conta" : "Conectar conta Mercado Livre"}</button>
            </form>
          )}
          {!status.connected && (
            <p className="mt-3 text-xs text-ink-muted">
              Enquanto a conta não for autorizada, use a simulação de homologação abaixo para testar importação, reserva e baixa.
            </p>
          )}
        </Card>

        {editable && (
          <Card title="Configuração do aplicativo">
            <ActionForm action={saveConfigAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Client ID (App ID)">
                <input name="clientId" required className={inputCls} placeholder={status.clientIdHint ?? ""} />
              </Field>
              <Field label="Client Secret">
                <input
                  name="clientSecret"
                  type="password"
                  autoComplete="off"
                  className={inputCls}
                  placeholder={status.clientSecretHint ? "em branco mantém o atual" : ""}
                />
              </Field>
              <Field label="URL de retorno (redirect URI)" className="sm:col-span-2">
                <input
                  name="redirectUri"
                  required
                  defaultValue={status.redirectUri ?? ""}
                  className={inputCls}
                  placeholder="https://seu-dominio/api/integrations/mercadolivre/callback"
                />
              </Field>
              <Field label="Vendedor responsável pelos pedidos" className="sm:col-span-2">
                <select name="defaultSellerId" defaultValue={status.defaultSellerId ?? ""} className={inputCls}>
                  <option value="">Mediador (padrão)</option>
                  {sellers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <button className={btnPrimary}>Salvar configuração</button>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>

      <Card title="Anúncios vinculados">
        <Table
          head={
            <>
              <th className={thCls}>Anúncio</th>
              <th className={thCls}>Produto</th>
              <th className={thCls}>Un./venda</th>
              <th className={thCls}>Disponível ML</th>
              <th className={thCls}>Último sync</th>
              <th className={thCls}>Ações</th>
            </>
          }
          empty={listings.length === 0 ? <div className="p-4"><EmptyState>Nenhum anúncio vinculado.</EmptyState></div> : undefined}
        >
          {listings.map((l) => (
            <tr key={l.id}>
              <td className={tdCls}>
                <div className="font-semibold">{l.externalId}</div>
                <div className="text-xs text-ink-muted">{l.title}</div>
                {!l.active && <Badge>Inativo</Badge>}
              </td>
              <td className={tdCls}>
                {l.product.sku} <span className="text-ink-muted">· {l.product.name}</span>
                {l.product._count.components > 0 && <div><Badge tone="gold">Kit</Badge></div>}
              </td>
              <td className={`${tdCls} tabular-nums`}>{l.unitsPerSale}</td>
              <td className={`${tdCls} tabular-nums font-semibold`}>{availability.get(l.id) ?? 0}</td>
              <td className={tdCls}>
                {l.lastStockSyncAt ? fmtDateTime(l.lastStockSyncAt) : "-"}
                {l.lastSyncError && <div className="max-w-xs text-[11px] text-critical">{l.lastSyncError}</div>}
              </td>
              <td className={tdCls}>
                {editable && (
                  <div className="flex flex-wrap gap-1.5">
                    <ActionButton action={syncListingAction} fields={{ id: l.id }} className={btnSecondary}>
                      Sincronizar
                    </ActionButton>
                    <Link href={`/mercado-livre?editar=${l.id}#anuncio`} className={btnSecondary}>
                      Editar
                    </Link>
                    <ActionButton action={deleteListingAction} fields={{ id: l.id }} className={btnDanger} confirm="Remover o vínculo deste anúncio?">
                      Remover
                    </ActionButton>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>

        {editable && (
          <div id="anuncio" className="mt-4 border-t border-gold-deep/25 pt-4">
            <h4 className="mb-2 text-xs font-semibold text-ink">{editing ? `Editar anúncio ${editing.externalId}` : "Vincular anúncio"}</h4>
            <ActionForm key={editing?.id ?? "novo"} action={saveListingAction} resetOnSuccess={!editing} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Código do anúncio">
                <input name="externalId" required defaultValue={editing?.externalId} placeholder="MLB1234567890" className={inputCls} />
              </Field>
              <Field label="Título" className="lg:col-span-2">
                <input name="title" required defaultValue={editing?.title} className={inputCls} />
              </Field>
              <Field label="Produto / kit">
                <select name="productId" required defaultValue={editing?.productId ?? ""} className={inputCls}>
                  <option value="">Selecione</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unidades por venda">
                <input name="unitsPerSale" type="number" min={1} defaultValue={editing?.unitsPerSale ?? 1} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Ativo
              </label>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <button className={btnPrimary}>{editing ? "Salvar anúncio" : "Vincular anúncio"}</button>
                {editing && (
                  <Link href="/mercado-livre" className={btnSecondary}>
                    Cancelar edição
                  </Link>
                )}
              </div>
            </ActionForm>
            <p className="mt-2 text-[11.5px] text-ink-faint">
              Anúncio de pacote (ex.: 25 LEDs) apontando para o SKU unitário: use 25 unidades por venda. Apontando para um produto kit: use 1, os componentes são baixados na reserva.
            </p>
          </div>
        )}
      </Card>

      {editable && (
        <Card title="Simular pedido Mercado Livre (homologação)">
          {listings.filter((l) => l.active).length === 0 ? (
            <EmptyState>Vincule um anúncio ativo para simular pedidos.</EmptyState>
          ) : (
            <ActionForm action={simulateOrderAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Field label="Anúncio" className="lg:col-span-2">
                <select name="listingId" required className={inputCls}>
                  {listings
                    .filter((l) => l.active)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.externalId} · {l.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Quantidade">
                <input name="quantity" type="number" min={1} defaultValue={1} required className={inputCls} />
              </Field>
              <Field label="Preço unitário (R$)">
                <input name="unitPrice" inputMode="decimal" required defaultValue="9,90" className={inputCls} />
              </Field>
              <Field label="Comprador (apelido)">
                <input name="nickname" defaultValue="COMPRADOR_TESTE" className={inputCls} />
              </Field>
              <Field label="Nº do pedido ML">
                <input name="externalId" placeholder="em branco gera SIM-..." className={inputCls} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-6">
                <button className={btnPrimary}>Simular pedido pago</button>
                <span className="ml-3 text-[11.5px] text-ink-faint">
                  Usa o mesmo processamento das notificações reais. Reenviar o mesmo nº não duplica o pedido nem a reserva.
                </span>
              </div>
            </ActionForm>
          )}
        </Card>
      )}

      <Card title="Pedidos Mercado Livre recentes">
        <Table
          head={
            <>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Pedido ML</th>
              <th className={thCls}>Comprador</th>
              <th className={thCls}>Total</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Data/hora</th>
            </>
          }
          empty={mlOrders.length === 0 ? <div className="p-4"><EmptyState>Nenhum pedido importado.</EmptyState></div> : undefined}
        >
          {mlOrders.map((o) => (
            <tr key={o.id}>
              <td className={tdCls}>
                <Link href={`/pedidos/${o.id}`} className="font-semibold text-gold hover:underline">
                  {orderCode(ctx.active.code, o.number)}
                </Link>
              </td>
              <td className={tdCls}>{o.externalId}</td>
              <td className={tdCls}>{o.contact.accountName ?? o.contact.firstName}</td>
              <td className={`${tdCls} tabular-nums`}>{fmtMoney(o.total)}</td>
              <td className={tdCls}>
                <Badge tone={o.status === "CANCELADO" ? "critical" : "info"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
              </td>
              <td className={tdCls}>{fmtDateTime(o.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Fila de integração">
        <Tabs
          active={statusFilter ?? "todos"}
          tabs={[
            { key: "todos", label: "Todos", href: "/mercado-livre", count: totalEvents },
            ...STATUSES.map((s) => ({
              key: s,
              label: INTEGRATION_STATUS_LABELS[s],
              href: `/mercado-livre?status=${s}`,
              count: countBy.get(s) ?? 0,
            })),
          ]}
        />
        <Table
          head={
            <>
              <th className={thCls}>Recebido</th>
              <th className={thCls}>Operação</th>
              <th className={thCls}>Ref. externa</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Tentativas</th>
              <th className={thCls}>Detalhe</th>
              <th className={thCls}></th>
            </>
          }
          empty={events.length === 0 ? <div className="p-4"><EmptyState>Nenhum evento.</EmptyState></div> : undefined}
        >
          {events.map((e) => (
            <tr key={e.id}>
              <td className={tdCls}>{fmtDateTime(e.createdAt)}</td>
              <td className={tdCls}>{e.operation === "order_simulated" ? "Pedido (simulado)" : e.operation}</td>
              <td className={tdCls}>{e.externalId ?? "-"}</td>
              <td className={tdCls}>
                <Badge tone={EVENT_TONE[e.status]}>{INTEGRATION_STATUS_LABELS[e.status]}</Badge>
              </td>
              <td className={`${tdCls} tabular-nums`}>{e.attempts}</td>
              <td className={tdCls}>
                {e.lastError && <div className="max-w-sm text-[11.5px] text-critical">{e.lastError}</div>}
                {e.resultRef && (
                  <Link href={`/pedidos/${e.resultRef}`} className="text-xs text-gold hover:underline">
                    Ver pedido
                  </Link>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-ink-faint">Payload</summary>
                  <pre className="mt-1 max-h-48 max-w-md overflow-auto rounded bg-surface-2 p-2 text-[10.5px] text-ink-muted">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </details>
              </td>
              <td className={tdCls}>
                {editable && (e.status === "ERRO" || e.status === "PENDENTE") && (
                  <ActionButton action={reprocessAction} fields={{ id: e.id }} className={btnSecondary}>
                    Reprocessar
                  </ActionButton>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Movimentações de estoque Mercado Livre">
        <Table
          head={
            <>
              <th className={thCls}>Data/hora</th>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Produto</th>
              <th className={thCls}>Tipo</th>
              <th className={thCls}>Qtd.</th>
              <th className={thCls}>Físico / reservado</th>
            </>
          }
          empty={movements.length === 0 ? <div className="p-4"><EmptyState>Sem movimentações de pedidos ML.</EmptyState></div> : undefined}
        >
          {movements.map((m) => {
            const o = orderById.get(m.documentId ?? "");
            return (
              <tr key={m.id}>
                <td className={tdCls}>{fmtDateTime(m.createdAt)}</td>
                <td className={tdCls}>{o ? `${orderCode(ctx.active.code, o.number)} (ML ${o.externalId})` : "-"}</td>
                <td className={tdCls}>
                  {m.product.sku} <span className="text-ink-muted">· {m.product.name}</span>
                </td>
                <td className={tdCls}>{MOVEMENT_LABELS[m.type]}</td>
                <td className={`${tdCls} tabular-nums`}>{m.quantity}</td>
                <td className={`${tdCls} tabular-nums`}>
                  {m.physicalAfter} / {m.reservedAfter}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
