import { requireView } from "@/lib/require-permission";
import { getKpis, getRevenueByMonth, getFunnel, getGoalProgress } from "@/lib/analytics";
import { getDailyTasks } from "@/lib/calls";
import { buildLineChart } from "@/lib/chart-utils";
import { DailyTasksPanel } from "@/components/home/DailyTasksPanel";

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default async function AnaliticaPage() {
  const session = await requireView("analitica");
  const [kpis, revenueByMonth, funnel, goal, dailyTasks] = await Promise.all([
    getKpis(session),
    getRevenueByMonth(session),
    getFunnel(session),
    getGoalProgress(session),
    getDailyTasks(session),
  ]);

  const { polyline, areaPath } = buildLineChart(revenueByMonth.map((m) => m.value));
  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1);
  const goal1Pct = goal?.goal1 ? Math.min(100, Math.round((goal.achieved / goal.goal1) * 100)) : 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Analítica</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Olá, {session.user.name ?? session.user.email} — indicadores em tempo real
        </p>
      </div>

      <DailyTasksPanel tasks={dailyTasks} />

      <div className="grid grid-cols-12 gap-4">
        {/* KPI row */}
        <div className="col-span-3 rounded-xl border border-gold-deep/28 bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Receita do mês</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">{currency(kpis.revenue)}</div>
          {kpis.revenueDelta !== null && (
            <span
              className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                kpis.revenueDelta >= 0 ? "bg-good/15 text-good" : "bg-critical/15 text-critical"
              }`}
            >
              {kpis.revenueDelta >= 0 ? "▲" : "▼"} {Math.abs(kpis.revenueDelta).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="col-span-3 rounded-xl border border-gold-deep/28 bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Negócios fechados</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">{kpis.dealsWon}</div>
        </div>
        <div className="col-span-3 rounded-xl border border-gold-deep/28 bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Ticket médio</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">{currency(kpis.avgTicket)}</div>
        </div>
        <div className="col-span-3 rounded-xl border border-gold-deep/28 bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Taxa de conversão</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">{kpis.conversionRate.toFixed(1)}%</div>
        </div>

        {/* Gráfico */}
        <div className="col-span-8 rounded-xl border border-gold-deep/28 bg-surface p-4">
          <div className="mb-2 text-[13px] font-semibold text-ink">Receita — últimos 6 meses</div>
          <svg viewBox="0 0 300 100" className="h-[150px] w-full" preserveAspectRatio="none">
            <path d={areaPath} fill="url(#analyticsGrad)" opacity="0.5" />
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--gold-bright)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold-bright)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--gold-bright)" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="mt-2 flex justify-between text-[10.5px] text-ink-faint">
            {revenueByMonth.map((m) => (
              <span key={m.label}>{m.label}</span>
            ))}
          </div>
        </div>

        {/* Medidor de meta */}
        <div className="col-span-4 rounded-xl border border-gold-deep/28 bg-surface p-4">
          <div className="mb-3 text-[13px] font-semibold text-ink">Medidor de meta</div>
          {goal ? (
            <div className="flex items-center gap-4">
              <div
                className="relative h-[110px] w-[110px] flex-none rounded-full"
                style={{
                  background: `conic-gradient(var(--gold-bright) 0% ${goal1Pct}%, var(--surface-2) ${goal1Pct}% 100%)`,
                }}
              >
                <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-surface">
                  <b className="text-lg text-ink">{goal1Pct}%</b>
                  <small className="text-[9px] uppercase text-ink-faint">da meta 1</small>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-[11.5px]">
                <div className="flex justify-between gap-3">
                  <span className="text-ink-faint">Meta 1</span>
                  <span className="text-ink">{goal.goal1 ? currency(goal.goal1) : "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-ink-faint">Atingido</span>
                  <span className="text-ink">{currency(goal.achieved)}</span>
                </div>
                {goal.goal2 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-faint">Meta 2</span>
                    <span className="text-ink">{currency(goal.goal2)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-faint">Sem meta configurada para este perfil.</p>
          )}
        </div>

        {/* Funil */}
        <div className="col-span-12 rounded-xl border border-gold-deep/28 bg-surface p-4">
          <div className="mb-3 text-[13px] font-semibold text-ink">Funil de vendas</div>
          <div className="flex flex-col gap-1.5">
            {funnel.map((stage, i) => {
              const widthPct = Math.max(8, Math.round((stage.count / maxFunnel) * 100));
              const shade = ["seq-2", "seq-3", "seq-4", "gold", "seq-5"][i] ?? "gold";
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <div className="w-40 flex-none text-[11.5px] text-ink-muted">{stage.name}</div>
                  <div
                    className="flex h-7 min-w-[2.5rem] items-center justify-end rounded-md px-2 text-[11px] font-bold text-black"
                    style={{ width: `${widthPct}%`, background: `var(--${shade})` }}
                  >
                    {stage.count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
