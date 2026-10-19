import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { resolveCompanyScope } from "@/lib/erp/company";
import { getDashboard } from "@/lib/erp/dashboard";
import { CHANNEL_LABELS } from "@/lib/erp/orders";
import { fmtMoney, fmtNumber } from "@/lib/erp/format";
import { Card, Kpi, NoCompany, PageHeader, Badge } from "@/components/erp/ui";
import { HBars, VBars } from "@/components/erp/painel/Bars";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function compact(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")} mil`;
  return fmtMoney(v);
}

export default async function PainelPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const session = await requireView("painel");
  const { empresa } = await searchParams;

  let scope;
  try {
    scope = await resolveCompanyScope(session, empresa);
  } catch {
    return (
      <div>
        <PageHeader title="Painel" />
        <NoCompany />
      </div>
    );
  }
  const { ctx, consolidated, companyIds, canConsolidate } = scope;
  const data = await getDashboard(session, companyIds);
  const companyName = (id: string) => {
    const c = ctx.companies.find((x) => x.id === id);
    return c ? `${c.code} · ${c.tradeName || c.name}` : id;
  };
  const currentMonth = new Date().getMonth();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Painel"
        subtitle={
          consolidated
            ? "Visão consolidada: totais somados, registros de cada empresa continuam separados."
            : `${ctx.active.code} · ${ctx.active.tradeName || ctx.active.name} · mês atual`
        }
        actions={
          canConsolidate && (
            <div className="flex rounded-lg border border-gold-deep/40 p-0.5 text-xs">
              <Link
                href="/painel"
                className={`rounded-md px-3 py-1.5 font-semibold ${!consolidated ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"}`}
              >
                Empresa ativa
              </Link>
              <Link
                href="/painel?empresa=todas"
                className={`rounded-md px-3 py-1.5 font-semibold ${consolidated ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"}`}
              >
                Consolidado
              </Link>
            </div>
          )
        }
      />

      {data.show.sales && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Vendas do mês" value={compact(data.revenue)} hint={fmtMoney(data.revenue)} />
          <Kpi label="Pedidos aprovados" value={fmtNumber(data.orders)} hint="no mês, sem cancelados" />
          <Kpi label="Ticket médio" value={fmtMoney(data.ticket)} />
          <Kpi label="Clientes ativos" value={fmtNumber(data.activeClients)} hint="compraram nos últimos 90 dias" />
        </div>
      )}

      {consolidated && data.show.sales && (
        <Card title="Por empresa (mês atual)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                  <th className="py-1.5 pr-3">Empresa</th>
                  <th className="py-1.5 pr-3 text-right">Vendas</th>
                  <th className="py-1.5 pr-3 text-right">Pedidos</th>
                  <th className="py-1.5 text-right">Clientes ativos</th>
                </tr>
              </thead>
              <tbody>
                {companyIds.map((id) => {
                  const row = data.byCompany.find((b) => b.companyId === id);
                  return (
                    <tr key={id} className="border-t border-gold-deep/20">
                      <td className="py-1.5 pr-3 text-ink">{companyName(id)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmtMoney(row?.revenue ?? 0)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row?.orders ?? 0}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {data.activeClientsByCompany.find((a) => a.companyId === id)?.count ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.show.sales && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Evolução das vendas (6 meses)" className="lg:col-span-2">
            <VBars
              rows={data.monthly.map((m) => {
                const month = Number(m.month.slice(5)) - 1;
                return { label: MONTHS[month], value: m.value, display: compact(m.value), highlight: month === currentMonth };
              })}
            />
          </Card>
          <Card title="Vendas por canal (mês)">
            {data.byChannel.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhuma venda aprovada no mês.</p>
            ) : (
              <HBars
                rows={data.byChannel.map((c) => ({
                  label: CHANNEL_LABELS[c.channel],
                  value: c.revenue,
                  display: fmtMoney(c.revenue),
                  sub: `${c.orders} ped.`,
                }))}
              />
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {data.show.sales && (
          <Card title="Produtos mais vendidos (mês)" className="lg:col-span-2">
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-ink-muted">Sem itens vendidos no mês.</p>
            ) : (
              <HBars
                rows={data.topProducts.map((p) => ({
                  label: `${p.sku} · ${p.name}`,
                  value: p.revenue,
                  display: fmtMoney(p.revenue),
                  sub: `${fmtNumber(p.qty)} un.`,
                }))}
              />
            )}
          </Card>
        )}
        <Card title="Pendências de pedidos">
          <ul className="flex flex-col gap-2 text-[13px]">
            <PendingRow href="/pedidos?status=AGUARDANDO_APROVACAO" label="Aguardando aprovação" count={data.pending.approval} />
            <PendingRow href="/expedicao" label="Para separar/conferir" count={data.pending.toPick} />
            <PendingRow href="/expedicao" label="Prontos para expedição" count={data.pending.readyToShip} />
            <PendingRow href="/fiscal" label="Aprovados sem nota autorizada" count={data.pending.withoutInvoice} />
          </ul>
          {data.margin && (
            <div className="mt-4 border-t border-gold-deep/25 pt-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">Margem bruta do mês</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">{data.margin.pct.toFixed(1).replace(".", ",")}%</p>
              <p className="text-[11.5px] text-ink-faint">
                {fmtMoney(data.margin.revenue - data.margin.cost)} sobre {fmtMoney(data.margin.revenue)}
              </p>
              {!data.margin.reliable && (
                <p className="mt-1 text-[11.5px] text-warning">Há itens sem custo cadastrado: margem superestimada.</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.show.stock && (
          <Card title="Estoque baixo" actions={<Link href="/estoque" className="text-xs text-gold hover:text-gold-bright">Ver estoque</Link>}>
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum produto abaixo do mínimo.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {data.lowStock.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{p.sku}</span> <span className="text-ink-muted">{p.name}</span>
                      {consolidated && <span className="ml-1 text-ink-faint">({companyName(p.companyId).split(" ·")[0]})</span>}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      <Badge tone={p.available <= 0 ? "critical" : "warning"}>
                        {fmtNumber(p.available)} / mín. {fmtNumber(p.minStock)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {data.show.finance && (
          <Card title="Financeiro" actions={<Link href="/financeiro" className="text-xs text-gold hover:text-gold-bright">Abrir</Link>}>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <FinCell label="A receber vencido" value={data.receivables.overdue} tone="critical" />
              <FinCell label="A receber 7 dias" value={data.receivables.next7} />
              <FinCell label="A pagar vencido" value={data.payables.overdue} tone="critical" />
              <FinCell label="A pagar 7 dias" value={data.payables.next7} />
            </dl>
          </Card>
        )}
        {data.show.fiscal && (
          <Card title="Pendências fiscais" actions={<Link href="/fiscal" className="text-xs text-gold hover:text-gold-bright">Abrir</Link>}>
            <ul className="flex flex-col gap-2 text-[13px]">
              <PendingRow href="/fiscal" label="Notas rejeitadas a corrigir" count={data.fiscal.rejected} critical />
              <PendingRow href="/fiscal" label="Pedidos aprovados sem nota" count={data.fiscal.withoutInvoice} />
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function PendingRow({ href, label, count, critical }: { href: string; label: string; count: number; critical?: boolean }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-surface-2">
        <span className="text-ink-muted">{label}</span>
        <Badge tone={count === 0 ? "neutral" : critical ? "critical" : "warning"}>{count}</Badge>
      </Link>
    </li>
  );
}

function FinCell({ label, value, tone }: { label: string; value: number; tone?: "critical" }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className={`text-base font-bold tabular-nums ${tone && value > 0 ? "text-critical" : "text-ink"}`}>{fmtMoney(value)}</dd>
    </div>
  );
}
