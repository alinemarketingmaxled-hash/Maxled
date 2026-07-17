import Link from "next/link";
import { MonthPicker } from "@/components/home/MonthPicker";
import { GoalProgressBar } from "@/components/home/GoalProgressBar";
import type { DailyTasks } from "@/lib/calls";
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
type CommissionTier = { y: number; value: number; pct: number | null };

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

const CARD = "rounded-xl border border-gold-deep/28 bg-surface p-4";

export function HomeSidebar({
  kpis,
  revenueByMonth,
  polyline,
  areaPath,
  commissionTiers,
  funnel,
  goal,
  dailyTasks,
  overdueTasks,
  selectedMonth,
}: {
  kpis: Kpis;
  revenueByMonth: RevenueMonth[];
  polyline: string;
  areaPath: string;
  commissionTiers: CommissionTier[];
  funnel: FunnelStage[];
  goal: Goal;
  dailyTasks: DailyTasks;
  overdueTasks: TaskRow[];
  selectedMonth: string;
}) {
  const todayItems = [
    ...dailyTasks.toCall.map((t) => ({ ...t, tag: "Ligar" })),
    ...dailyTasks.toQuote.map((t) => ({ ...t, tag: "Cotação" })),
    ...dailyTasks.urgent.map((t) => ({ ...t, tag: "Urgente" })),
  ].slice(0, 5);

  return (
    <aside className="flex flex-col gap-3.5">
      <div className={CARD}>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-ink">Resumo geral</h3>
          <MonthPicker selected={selectedMonth} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-[11.5px]">
          <div>
            <div className="text-ink-faint">Faturamento</div>
            <div className="text-[15px] font-bold text-ink">{currency(kpis.revenue)}</div>
          </div>
          <div>
            <div className="text-ink-faint">Negócios fechados</div>
            <div className="text-[15px] font-bold text-ink">{kpis.dealsWon}</div>
          </div>
          <div>
            <div className="text-ink-faint">Ticket médio</div>
            <div className="text-[15px] font-bold text-ink">{currency(kpis.avgTicket)}</div>
          </div>
          <div>
            <div className="text-ink-faint">Conversão</div>
            <div className="text-[15px] font-bold text-ink">{kpis.conversionRate.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {goal?.goal1 != null && (
        <div className={CARD}>
          <h3 className="mb-2.5 text-[13px] font-semibold text-ink">Meta do mês</h3>
          <GoalProgressBar
            achieved={goal.achieved}
            goal1={goal.goal1}
            goal2={goal.goal2}
            commissionPct1={goal.commissionPct1}
            commissionPct2={goal.commissionPct2}
          />
          <div className="mt-2 flex justify-between text-[11.5px]">
            <span className="text-ink-faint">
              Comissão{goal.effectiveCommissionPct !== null && ` (${goal.effectiveCommissionPct.toFixed(2)}%)`}
            </span>
            <span className="font-semibold text-gold-bright">{currency(goal.commissionEarned)}</span>
          </div>
        </div>
      )}

      <div className={CARD}>
        <h3 className="mb-2.5 text-[13px] font-semibold text-ink">Receita — últimos 6 meses</h3>
        <svg viewBox="0 0 300 100" className="h-[80px] w-full" preserveAspectRatio="none">
          <path d={areaPath} fill="url(#sidebarGrad)" opacity="0.5" />
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
              opacity="0.6"
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
            <linearGradient id="sidebarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold-bright)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--gold-bright)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="mt-1 flex justify-between text-[9.5px] text-ink-faint">
          {revenueByMonth.map((m) => (
            <span key={m.label}>{m.label}</span>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <h3 className="mb-2.5 text-[13px] font-semibold text-ink">Funil de vendas</h3>
        <div className="flex flex-col gap-1.5 text-[12px]">
          {funnel.map((f) => (
            <div key={f.name} className="flex items-center justify-between">
              <span className="text-ink-muted">{f.name}</span>
              <span className="font-semibold text-ink">{f.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-ink">Tarefas de hoje</h3>
          <Link href="/agenda" className="text-[10.5px] text-gold-bright hover:underline">
            Ver todas
          </Link>
        </div>
        {todayItems.length === 0 ? (
          <p className="text-[11.5px] text-ink-faint">Nada pendente hoje.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {todayItems.map((t) => (
              <div key={`${t.tag}-${t.contactId}`} className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="truncate text-ink-muted">
                  {t.tag} · {t.contactName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-critical/30 bg-surface p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-critical">Atrasados</h3>
          <Link href="/agenda" className="text-[10.5px] text-gold-bright hover:underline">
            Ver todos
          </Link>
        </div>
        {overdueTasks.length === 0 ? (
          <p className="text-[11.5px] text-ink-faint">Tudo em dia!</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {overdueTasks.slice(0, 5).map((t) => {
              const days = daysSince(t.dueDate);
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-ink-muted">{t.title}</span>
                  <span className="flex-none text-critical">{days !== null ? `${days} dias` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
