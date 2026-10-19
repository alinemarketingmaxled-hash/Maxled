import { getCashFlow } from "@/lib/erp/finance";
import { fmtDate, fmtMoney } from "@/lib/erp/format";
import { Badge, Card, EmptyState, Kpi, Table, tdCls, thCls } from "@/components/erp/ui";

/** Fluxo de caixa diário: realizado (baixas efetivas) nos últimos 30 dias e
 * previsto (saldos em aberto por vencimento) nos próximos 60. Vencidos em
 * aberto entram no dia de hoje. */
export async function CashFlowTab({ companyId }: { companyId: string }) {
  const days = await getCashFlow([companyId], 30, 60);
  if (days.length === 0) return <EmptyState>Sem movimentações realizadas ou previstas no período.</EmptyState>;

  const max = Math.max(...days.map((d) => Math.max(d.inflow, d.outflow)), 1);
  const realized = days.filter((d) => !d.projected);
  const projected = days.filter((d) => d.projected);
  const sum = (arr: typeof days, k: "inflow" | "outflow") => arr.reduce((s, d) => s + d[k], 0);
  const rows = days.reduce<(typeof days[number] & { net: number; running: number })[]>((acc, d) => {
    const net = d.inflow - d.outflow;
    acc.push({ ...d, net, running: (acc.at(-1)?.running ?? 0) + net });
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Recebido (30 dias)" value={fmtMoney(sum(realized, "inflow"))} />
        <Kpi label="Pago (30 dias)" value={fmtMoney(sum(realized, "outflow"))} />
        <Kpi label="A receber (60 dias)" value={fmtMoney(sum(projected, "inflow"))} hint="inclui vencidos em aberto" />
        <Kpi label="A pagar (60 dias)" value={fmtMoney(sum(projected, "outflow"))} hint="inclui vencidos em aberto" />
      </div>
      <Card title="Fluxo diário">
        <p className="mb-2 flex flex-wrap gap-4 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-good" /> Entradas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-critical" /> Saídas
          </span>
          <span>Linhas marcadas como &quot;Previsto&quot; vêm de títulos em aberto; &quot;Realizado&quot;, de baixas registradas.</span>
        </p>
        <Table
          head={
            <>
              <th className={thCls}>Data</th>
              <th className={thCls}>Tipo</th>
              <th className={`${thCls} text-right`}>Entradas</th>
              <th className={`${thCls} text-right`}>Saídas</th>
              <th className={`${thCls} text-right`}>Saldo do dia</th>
              <th className={`${thCls} text-right`}>Acumulado</th>
              <th className={`${thCls} w-[28%]`}>Visual</th>
            </>
          }
        >
          {rows.map((d) => {
            const { net, running } = d;
            return (
              <tr key={`${d.date}-${d.projected}`}>
                <td className={`${tdCls} whitespace-nowrap`}>{fmtDate(`${d.date}T12:00:00Z`)}</td>
                <td className={tdCls}>{d.projected ? <Badge tone="info">Previsto</Badge> : <Badge tone="good">Realizado</Badge>}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{d.inflow ? fmtMoney(d.inflow) : "-"}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{d.outflow ? fmtMoney(d.outflow) : "-"}</td>
                <td className={`${tdCls} text-right tabular-nums ${net < 0 ? "text-critical" : ""}`}>{fmtMoney(net)}</td>
                <td className={`${tdCls} text-right tabular-nums ${running < 0 ? "text-critical" : ""}`}>{fmtMoney(running)}</td>
                <td className={tdCls}>
                  <div className="flex flex-col gap-0.5" aria-hidden="true">
                    <div className={`h-1.5 rounded-sm bg-good ${d.projected ? "opacity-50" : ""}`} style={{ width: `${(d.inflow / max) * 100}%` }} />
                    <div className={`h-1.5 rounded-sm bg-critical ${d.projected ? "opacity-50" : ""}`} style={{ width: `${(d.outflow / max) * 100}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
