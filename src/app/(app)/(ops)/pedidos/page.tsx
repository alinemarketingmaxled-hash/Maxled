import Link from "next/link";
import type { Prisma, SalesChannel, SalesOrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canEdit, getPermission } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { orderScopeWhere } from "@/lib/erp/orders";
import { fmtDate, fmtMoney, orderCode } from "@/lib/erp/format";
import { PageHeader, Table, Tabs, NoCompany, EmptyState, thCls, tdCls, inputCls, btnPrimary, btnSecondary } from "@/components/erp/ui";
import { OrderStatusBadge } from "@/components/erp/pedidos/OrderStatusBadge";
import { CHANNEL_LABELS_SHORT } from "@/components/erp/pedidos/labels";

const TAB_STATUSES: Record<string, { label: string; statuses: SalesOrderStatus[] | null }> = {
  cotacoes: { label: "Cotações", statuses: ["COTACAO"] },
  aprovacao: { label: "Aguardando aprovação", statuses: ["AGUARDANDO_APROVACAO"] },
  andamento: { label: "Em andamento", statuses: ["APROVADO", "EM_SEPARACAO", "EM_CONFERENCIA", "PRONTO_EXPEDICAO"] },
  enviados: { label: "Enviados/entregues", statuses: ["ENVIADO", "ENTREGUE"] },
  cancelados: { label: "Cancelados", statuses: ["CANCELADO"] },
  todos: { label: "Todos", statuses: null },
};

const CHANNELS: SalesChannel[] = ["DIRETO", "MERCADO_LIVRE", "PORTAL", "OUTRO"];

type Search = { aba?: string; vendedor?: string; de?: string; ate?: string; cliente?: string; canal?: string };

export default async function PedidosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireView("pedidos");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const params = await searchParams;
  const tab = params.aba && TAB_STATUSES[params.aba] ? params.aba : "todos";
  const ownScope = getPermission(session.user.role, "pedidos").scope === "own";
  const editable = canEdit(session.user.role, "pedidos");

  // Filtros comuns às abas (contagens refletem os filtros, não a aba).
  const base: Prisma.SalesOrderWhereInput = { ...orderScopeWhere(session, ctx.active.id) };
  if (!ownScope && params.vendedor) base.sellerId = params.vendedor;
  if (params.canal && (CHANNELS as string[]).includes(params.canal)) base.channel = params.canal as SalesChannel;
  const from = params.de ? new Date(`${params.de}T00:00:00-03:00`) : null;
  const to = params.ate ? new Date(`${params.ate}T23:59:59-03:00`) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    base.createdAt = {
      ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
      ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
    };
  }
  if (params.cliente?.trim()) {
    const q = params.cliente.trim();
    base.contact = {
      OR: [
        { accountName: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { cnpj: { contains: q } },
      ],
    };
  }
  const statuses = TAB_STATUSES[tab].statuses;
  const where: Prisma.SalesOrderWhereInput = statuses ? { ...base, status: { in: statuses } } : base;

  const [orders, grouped, sellers] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, number: true, status: true, channel: true, total: true, createdAt: true,
        contact: { select: { firstName: true, lastName: true, accountName: true } },
        seller: { select: { name: true } },
      },
    }),
    prisma.salesOrder.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    ownScope
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { deletedAt: null, companies: { some: { companyId: ctx.active.id } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);
  const countFor = (st: SalesOrderStatus[] | null) =>
    grouped.filter((g) => !st || st.includes(g.status)).reduce((s, g) => s + g._count._all, 0);

  const qs = (overrides: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/pedidos?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Cotações e pedidos"
        subtitle={`${ctx.active.code} · ${ctx.active.tradeName || ctx.active.name}${ownScope ? " · somente a sua carteira" : ""}`}
        actions={
          editable && (
            <Link href="/pedidos/nova" className={btnPrimary}>
              Nova cotação
            </Link>
          )
        }
      />

      <Tabs
        active={tab}
        tabs={Object.entries(TAB_STATUSES).map(([key, t]) => ({
          key,
          label: t.label,
          href: qs({ aba: key }),
          count: countFor(t.statuses),
        }))}
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <input type="hidden" name="aba" value={tab} />
        <input name="cliente" defaultValue={params.cliente ?? ""} placeholder="Cliente ou CNPJ" className={`${inputCls} lg:col-span-2`} />
        {!ownScope && (
          <select name="vendedor" defaultValue={params.vendedor ?? ""} className={inputCls}>
            <option value="">Todos os vendedores</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <select name="canal" defaultValue={params.canal ?? ""} className={inputCls}>
          <option value="">Todos os canais</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{CHANNEL_LABELS_SHORT[c]}</option>
          ))}
        </select>
        <input type="date" name="de" defaultValue={params.de ?? ""} className={inputCls} aria-label="De" />
        <input type="date" name="ate" defaultValue={params.ate ?? ""} className={inputCls} aria-label="Até" />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button className={btnSecondary}>Filtrar</button>
          <Link href="/pedidos" className={btnSecondary}>Limpar</Link>
        </div>
      </form>

      {orders.length === 0 ? (
        <EmptyState>Nenhum pedido encontrado com esses filtros.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Número</th>
              <th className={thCls}>Cliente</th>
              <th className={thCls}>Vendedor</th>
              <th className={thCls}>Canal</th>
              <th className={thCls}>Status</th>
              <th className={`${thCls} text-right`}>Total</th>
              <th className={thCls}>Data</th>
            </>
          }
        >
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-surface-2">
              <td className={tdCls}>
                <Link href={`/pedidos/${o.id}`} className="font-semibold text-gold hover:underline">
                  {orderCode(ctx.active.code, o.number)}
                </Link>
              </td>
              <td className={tdCls}>{o.contact.accountName || `${o.contact.firstName} ${o.contact.lastName}`}</td>
              <td className={tdCls}>{o.seller.name}</td>
              <td className={tdCls}>{CHANNEL_LABELS_SHORT[o.channel]}</td>
              <td className={tdCls}><OrderStatusBadge status={o.status} /></td>
              <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(o.total)}</td>
              <td className={`${tdCls} tabular-nums`}>{fmtDate(o.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
      {orders.length === 200 && <p className="mt-2 text-xs text-ink-faint">Mostrando os 200 mais recentes. Use os filtros para refinar.</p>}
    </div>
  );
}
