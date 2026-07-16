"use client";

import { useState } from "react";
import type { DailyTasks } from "@/lib/calls";
import { DailyTasksPanel } from "@/components/home/DailyTasksPanel";
import { OverdueTasksPanel } from "@/components/home/OverdueTasksPanel";
import { MonthPicker } from "@/components/home/MonthPicker";
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
  personalGoal: number | null;
} | null;
type SellerPerformance = { id: string; name: string; achieved: number; commissionEarned: number };

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
  kpis,
  revenueByMonth,
  polyline,
  areaPath,
  funnel,
  goal,
  goal1Pct,
  personalGoalPct,
  teamPerformance,
  selectedMonth,
  isCurrentMonth,
}: {
  dailyTasks: DailyTasks;
  overdueTasks: TaskRow[];
  canEditAgenda: boolean;
  kpis: Kpis;
  revenueByMonth: RevenueMonth[];
  polyline: string;
  areaPath: string;
  funnel: FunnelStage[];
  goal: Goal;
  goal1Pct: number;
  personalGoalPct: number;
  teamPerformance: SellerPerformance[] | null;
  selectedMonth: string;
  isCurrentMonth: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("hoje");
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

      {tab === "hoje" && <DailyTasksPanel tasks={dailyTasks} />}

      {tab === "atrasos" && <OverdueTasksPanel tasks={overdueTasks} canEdit={canEditAgenda} />}

      {tab === "desempenho" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 flex items-center justify-between gap-3">
            {!isCurrentMonth && (
              <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
                Mostrando um mês anterior — os números do mês atual continuam intactos
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11.5px] text-ink-faint">Ver meses anteriores</span>
              <MonthPicker selected={selectedMonth} />
            </div>
          </div>

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

          <div className="col-span-4 rounded-xl border border-gold-deep/28 bg-surface p-4">
            <div className="mb-3 text-[13px] font-semibold text-ink">Medidor de meta</div>
            {goal ? (
              <div className="flex flex-col gap-3">
                {goal.goal1 !== null && (
                  <div className="flex items-center gap-4">
                    <div
                      className="relative h-[110px] w-[110px] flex-none rounded-full"
                      style={{
                        background: `conic-gradient(var(--gold-bright) 0% ${goal1Pct}%, var(--black-surface-2) ${goal1Pct}% 100%)`,
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
                        <span className="text-ink">{currency(goal.goal1)}</span>
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
                      <div className="mt-1 flex justify-between gap-3 border-t border-dashed border-gold-deep/25 pt-1">
                        <span className="text-ink-faint">Comissão do mês</span>
                        <span className="font-semibold text-gold-bright">
                          {currency(goal.commissionEarned)}
                        </span>
                      </div>
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
                        Comissão{" "}
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
