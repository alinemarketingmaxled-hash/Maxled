"use client";

import { useState } from "react";
import type { DailyTasks } from "@/lib/calls";
import { DailyTasksPanel } from "@/components/home/DailyTasksPanel";
import { OverdueTasksPanel } from "@/components/home/OverdueTasksPanel";
import { useRouter } from "next/navigation";
import { MonthPicker } from "@/components/home/MonthPicker";
import { DateRangePicker } from "@/components/home/DateRangePicker";
import { InProgressDealsPanel, type InProgressDeal } from "@/components/home/InProgressDealsPanel";
import { GoalProgressBar } from "@/components/home/GoalProgressBar";
import type { TaskRow } from "@/components/agenda/TaskList";

type Kpis = {
  revenue: number;
  revenueDelta: number | null;
  dealsWon: number;
  avgTicket: number;
  conversionRate: number;
};
type RevenueMonth = { label: string; value: number };
type FunnelStage = { name: string; count: number };
type Goal = {
  name: string;
  achieved: number;
  goal1: number | null;
  goal2: number | null;
  commissionPct1: number | null;
  commissionPct2: number | null;
  commissionEarned: number;
  effectiveCommissionPct: number | null;
  personalGoal: number | null;
} | null;
type SellerPerformance = {
  id: string;
  name: string;
  achieved: number;
  commissionEarned: number;
  effectiveCommissionPct: number | null;
};
type CommissionTier = { y: number; value: number; pct: number | null };

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const TABS = [
  { key: "hoje", label: "☀ Hoje" },
  { key: "atrasos", label: "⏰ Atrasos" },
  { key: "desempenho", label: "📊 Desempenho" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AnaliticaTabs({
  dailyTasks,
  overdueTasks,
  canEditAgenda,
  canEditNegocios,
  inProgressDeals,
  kpis,
  revenueByMonth,
  polyline,
  areaPath,
  commissionTiers,
  funnel,
  goal,
  personalGoalPct,
  teamPerformance,
  selectedMonth,
  isCurrentMonth,
  periodMode,
  selectedRangeFrom,
  selectedRangeTo,
}: {
  dailyTasks: DailyTasks;
  overdueTasks: TaskRow[];
  canEditAgenda: boolean;
  canEditNegocios: boolean;
  inProgressDeals: InProgressDeal[];
  kpis: Kpis;
  revenueByMonth: RevenueMonth[];
  polyline: string;
  areaPath: string;
  commissionTiers: CommissionTier[];
  funnel: FunnelStage[];
  goal: Goal;
  personalGoalPct: number;
  teamPerformance: SellerPerformance[] | null;
  selectedMonth: string;
  isCurrentMonth: boolean;
  periodMode: "month" | "range";
  selectedRangeFrom: string;
  selectedRangeTo: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("hoje");
  const [periodUi, setPeriodUi] = useState<"month" | "range">(periodMode);
  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <div>
      <div className="mb-4 flex gap-1.5 rounded-lg bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === t.key ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hoje" && (
        <>
          <DailyTasksPanel tasks={dailyTasks} />
          <InProgressDealsPanel deals={inProgressDeals} canEdit={canEditNegocios} />
        </>
      )}

      {tab === "atrasos" && <OverdueTasksPanel tasks={overdueTasks} canEdit={canEditAgenda} />}

      {tab === "desempenho" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 flex items-center justify-between gap-3">
            {periodMode === "month" && !isCurrentMonth && (
              <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
                Mostrando um mês anterior — os números do mês atual continuam intactos
              </span>
            )}
            {periodMode === "range" && (
              <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
                Mostrando um período personalizado — meta e comissão continuam referentes ao mês atual
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex gap-0.5 rounded-md bg-surface-2 p-0.5">
                <button
                  onClick={() => {
                    setPeriodUi("month");
                    if (periodMode !== "month") router.push("/");
                  }}
                  className={`rounded px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    periodUi === "month" ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Mês
                </button>
                <button
                  onClick={() => setPeriodUi("range")}
                  className={`rounded px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    periodUi === "range" ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Período
                </button>
              </div>
              {periodUi === "month" ? (
                <>
                  <span className="text-[11.5px] text-ink-faint">Ver meses anteriores</span>
                  <MonthPicker selected={selectedMonth} />
                </>
              ) : (
                <DateRangePicker from={selectedRangeFrom} to={selectedRangeTo} />
              )}
            </div>
          </div>

          <div className="col-span-3 rounded-xl border border-gold-deep/28 bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">
              {periodMode === "range" ? "Receita no período" : "Receita do mês"}
            </div>
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

          <div className="col-span-8 rounded-xl border border-gold-deep/28 bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">
                {periodMode === "range" ? "Receita — período selecionado" : "Receita — últimos 6 meses"}
              </span>
              {commissionTiers.length > 0 && (
                <span className="text-[10px] text-ink-faint">
                  ┄┄ linha marca onde a comissão sobe
                </span>
              )}
            </div>
            <div className="relative">
              <svg viewBox="0 0 300 100" className="h-[150px] w-full" preserveAspectRatio="none">
                <path d={areaPath} fill="url(#analyticsGrad)" opacity="0.5" />
                {commissionTiers.map((tier, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={tier.y}
                    x2="300"
                    y2={tier.y}
                    stroke="var(--status-good)"
                    strokeWidth="1"
                    strokeDasharray="5 4"
                    opacity="0.7"
                  />
                ))}
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
              {commissionTiers.map((tier, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute left-1 -translate-y-1/2 whitespace-nowrap rounded bg-surface/90 px-1 text-[9.5px] font-semibold text-good"
                  style={{ top: `${Math.min(96, Math.max(4, tier.y))}%` }}
                >
                  {currency(tier.value)}
                  {tier.pct !== null ? ` · ${tier.pct}%` : ""}
                </span>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10.5px] text-ink-faint">
              {revenueByMonth.map((m) => (
                <span key={m.label}>{m.label}</span>
              ))}
            </div>
          </div>

          <div className="col-span-4 rounded-xl border border-gold-deep/28 bg-surface p-4">
            <div className="mb-3 text-[13px] font-semibold text-ink">Medidor de meta</div>
            {goal ? (
              <div className="flex flex-col gap-3">
                {goal.goal1 !== null && (
                  <div>
                    <GoalProgressBar
                      achieved={goal.achieved}
                      goal1={goal.goal1}
                      goal2={goal.goal2}
                      commissionPct1={goal.commissionPct1}
                      commissionPct2={goal.commissionPct2}
                    />
                    <div className="mt-1 flex justify-between gap-3 border-t border-dashed border-gold-deep/25 pt-2 text-[11.5px]">
                      <span className="text-ink-faint">Comissão do mês</span>
                      <span className="font-semibold text-gold-bright">
                        {currency(goal.commissionEarned)}
                        {goal.effectiveCommissionPct !== null && (
                          <span className="ml-1 text-[10.5px] font-normal text-ink-faint">
                            ({goal.effectiveCommissionPct.toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
                {goal.personalGoal !== null && (
                  <div className={goal.goal1 !== null ? "border-t border-dashed border-gold-deep/25 pt-3" : ""}>
                    <div className="mb-1 flex justify-between text-[11.5px]">
                      <span className="text-ink-faint">Minha meta pessoal</span>
                      <span className="text-ink">
                        {currency(goal.achieved)} / {currency(goal.personalGoal)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gold-solid transition-[width]"
                        style={{ width: `${personalGoalPct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-[10.5px] text-ink-faint">{personalGoalPct}%</div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-ink-faint">Sem meta configurada para este perfil.</p>
            )}
          </div>

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

          {teamPerformance && teamPerformance.length > 0 && (
            <div className="col-span-12 rounded-xl border border-gold-deep/28 bg-surface p-4">
              <div className="mb-3 text-[13px] font-semibold text-ink">
                Faturamento e comissão por vendedor
              </div>
              <div className="flex flex-col gap-1.5">
                {teamPerformance.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-b border-dashed border-gold-deep/18 py-1.5 text-[12.5px] last:border-b-0"
                  >
                    <span className="text-ink">{s.name}</span>
                    <div className="flex gap-6 tabular-nums">
                      <span className="text-ink-muted">
                        Faturamento <b className="text-ink">{currency(s.achieved)}</b>
                      </span>
                      <span className="text-ink-muted">
                        Comissão{s.effectiveCommissionPct !== null && ` (${s.effectiveCommissionPct.toFixed(2)}%)`}{" "}
                        <b className={s.commissionEarned > 0 ? "text-gold-bright" : "text-ink"}>
                          {currency(s.commissionEarned)}
                        </b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
