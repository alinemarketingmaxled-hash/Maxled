import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getKpis, getRevenueByMonth, getFunnel, getGoalProgress } from "@/lib/analytics";
import { getDailyTasks } from "@/lib/calls";
import { getOverdueTasks } from "@/lib/tasks";
import { buildLineChart } from "@/lib/chart-utils";
import { AnaliticaTabs } from "@/components/home/AnaliticaTabs";
import { QuickNav } from "@/components/home/QuickNav";

function parseMonthParam(mes: string | undefined): Date {
  if (!mes) return new Date();
  const [year, month] = mes.split("-").map(Number);
  if (!year || !month) return new Date();
  return new Date(year, month - 1, 1);
}

export default async function AnaliticaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await requireView("analitica");
  const { mes } = await searchParams;
  const referenceDate = parseMonthParam(mes);
  const now = new Date();
  const selectedMonth = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth =
    referenceDate.getFullYear() === now.getFullYear() && referenceDate.getMonth() === now.getMonth();

  const [kpis, revenueByMonth, funnel, goal, dailyTasks, overdueTasks] = await Promise.all([
    getKpis(session, referenceDate),
    getRevenueByMonth(session),
    getFunnel(session),
    getGoalProgress(session, referenceDate),
    getDailyTasks(session),
    getOverdueTasks(session),
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
        overdueTasks={overdueTasks.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          done: t.done,
          ownerName: t.owner.name,
        }))}
        canEditAgenda={canEdit(session.user.role, "agenda")}
        kpis={kpis}
        revenueByMonth={revenueByMonth}
        polyline={polyline}
        areaPath={areaPath}
        funnel={funnel}
        goal={goal}
        goal1Pct={goal1Pct}
        selectedMonth={selectedMonth}
        isCurrentMonth={isCurrentMonth}
      />
    </div>
  );
}
