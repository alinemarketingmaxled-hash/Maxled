import { requireView } from "@/lib/require-permission";
import { getKpis, getRevenueByMonth, getFunnel, getGoalProgress } from "@/lib/analytics";
import { getDailyTasks } from "@/lib/calls";
import { buildLineChart } from "@/lib/chart-utils";
import { AnaliticaTabs } from "@/components/home/AnaliticaTabs";
import { QuickNav } from "@/components/home/QuickNav";

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
  const goal1Pct = goal?.goal1 ? Math.min(100, Math.round((goal.achieved / goal.goal1) * 100)) : 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Analítica</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Olá, {session.user.name ?? session.user.email} — indicadores em tempo real
        </p>
      </div>

      <QuickNav role={session.user.role} />

      <AnaliticaTabs
        dailyTasks={dailyTasks}
        kpis={kpis}
        revenueByMonth={revenueByMonth}
        polyline={polyline}
        areaPath={areaPath}
        funnel={funnel}
        goal={goal}
        goal1Pct={goal1Pct}
      />
    </div>
  );
}
