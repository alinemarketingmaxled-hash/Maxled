import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import {
  getKpis,
  getKpisForRange,
  getRevenueByMonth,
  getRevenueByMonthRange,
  getFunnel,
  getGoalProgress,
  getTeamPerformance,
  type DateRange,
} from "@/lib/analytics";
import { getDailyTasks } from "@/lib/calls";
import { getOverdueTasks } from "@/lib/tasks";
import { getInProgressDeals } from "@/lib/deals";
import { listProspects, listProspectStages, listPendingActivationRequests } from "@/lib/prospects";
import { assignableOwners } from "@/app/(app)/vendas/actions";
import { buildLineChart } from "@/lib/chart-utils";
import { AnaliticaTabs } from "@/components/home/AnaliticaTabs";

function parseMonthParam(mes: string | undefined): Date {
  if (!mes) return new Date();
  const [year, month] = mes.split("-").map(Number);
  if (!year || !month) return new Date();
  return new Date(year, month - 1, 1);
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MAX_RANGE_YEARS = 5;

/** "ate" is treated as inclusive of the whole day, so the query's exclusive
 * upper bound is the day after it. Clamped to a sane span so a fat-fingered
 * date doesn't trigger a runaway multi-decade bucket query. */
function parseRangeParams(de: string | undefined, ate: string | undefined): DateRange | null {
  if (!de || !ate) return null;
  const from = new Date(`${de}T00:00:00`);
  const toRaw = new Date(`${ate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(toRaw.getTime())) return null;
  let to = new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate() + 1);
  if (to <= from) return null;
  const maxTo = new Date(from.getFullYear() + MAX_RANGE_YEARS, from.getMonth(), from.getDate());
  if (to > maxTo) to = maxTo;
  return { from, to };
}

export default async function AnaliticaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; de?: string; ate?: string }>;
}) {
  const session = await requireView("analitica");
  const { mes, de, ate } = await searchParams;
  const range = parseRangeParams(de, ate);
  const referenceDate = parseMonthParam(mes);
  const now = new Date();
  const selectedMonth = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth =
    referenceDate.getFullYear() === now.getFullYear() && referenceDate.getMonth() === now.getMonth();

  const defaultRangeTo = now;
  const defaultRangeFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const selectedRangeFrom = range ? toIsoDate(range.from) : toIsoDate(defaultRangeFrom);
  const selectedRangeTo = range
    ? toIsoDate(new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1))
    : toIsoDate(defaultRangeTo);

  const [
    kpis,
    revenueByMonth,
    funnel,
    goal,
    teamPerformance,
    dailyTasks,
    overdueTasks,
    inProgressDeals,
    prospects,
    prospectStages,
    pendingActivations,
    prospectOwners,
  ] = await Promise.all([
    range ? getKpisForRange(session, range) : getKpis(session, referenceDate),
    range ? getRevenueByMonthRange(session, range.from, range.to) : getRevenueByMonth(session),
    getFunnel(session),
    getGoalProgress(session, referenceDate),
    getTeamPerformance(session, referenceDate),
    getDailyTasks(session),
    getOverdueTasks(session),
    getInProgressDeals(session),
    listProspects(session),
    listProspectStages(),
    listPendingActivationRequests(session),
    assignableOwners(session),
  ]);

  const goalTiers = [
    goal?.goal1 != null ? { value: goal.goal1, pct: goal.commissionPct1 } : null,
    goal?.goal2 != null ? { value: goal.goal2, pct: goal.commissionPct2 } : null,
  ].filter((t): t is { value: number; pct: number | null } => t !== null);

  const { polyline, areaPath, valueToY } = buildLineChart(
    revenueByMonth.map((m) => m.value),
    goalTiers.map((t) => t.value),
  );
  const commissionTiers = goalTiers.map((t) => ({ y: valueToY(t.value), value: t.value, pct: t.pct }));

  const personalGoalPct = goal?.personalGoal
    ? Math.min(100, Math.round((goal.achieved / goal.personalGoal) * 100))
    : 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Início</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Olá, {session.user.name ?? session.user.email} — indicadores em tempo real
        </p>
      </div>

      <AnaliticaTabs
        dailyTasks={dailyTasks}
        overdueTasks={overdueTasks.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          done: t.done,
          ownerName: t.owner.name,
          dealId: t.dealId,
          dealName: t.deal?.name ?? null,
        }))}
        canEditAgenda={canEdit(session.user.role, "agenda")}
        canEditNegocios={canEdit(session.user.role, "negocios")}
        inProgressDeals={inProgressDeals.map((d) => ({
          id: d.id,
          name: d.name,
          value: Number(d.value),
          stageName: d.stage.name,
          contactName: `${d.contact.firstName} ${d.contact.lastName}`,
          accountName: d.contact.accountName,
          ownerName: d.owner.name,
        }))}
        kpis={kpis}
        revenueByMonth={revenueByMonth}
        polyline={polyline}
        areaPath={areaPath}
        commissionTiers={commissionTiers}
        funnel={funnel}
        goal={goal}
        personalGoalPct={personalGoalPct}
        teamPerformance={teamPerformance}
        selectedMonth={selectedMonth}
        isCurrentMonth={isCurrentMonth}
        periodMode={range ? "range" : "month"}
        selectedRangeFrom={selectedRangeFrom}
        selectedRangeTo={selectedRangeTo}
        prospects={prospects.map((p) => ({
          id: p.id,
          ownerId: p.ownerId,
          ownerName: p.owner.name,
          name: p.name,
          clientName: p.clientName,
          phone: p.phone,
          email: p.email,
          temperature: p.temperature,
          profile: p.profile,
          notes: p.notes,
          contactDate: p.contactDate.toISOString(),
          lastTouchedAt: p.lastTouchedAt.toISOString(),
          currentStageId: p.currentStageId,
          stageValues: p.stageValues.map((v) => ({
            stageId: v.stageId,
            date: v.date ? v.date.toISOString() : null,
            note: v.note,
            done: v.done,
          })),
          activation: p.activationRequest
            ? {
                id: p.activationRequest.id,
                status: p.activationRequest.status,
                rejectionReason: p.activationRequest.rejectionReason,
              }
            : null,
        }))}
        prospectStages={prospectStages.map((s) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          isClientStage: s.isClientStage,
        }))}
        isMediator={session.user.role === "MEDIATOR"}
        pendingActivations={pendingActivations.map((r) => ({
          id: r.id,
          prospectName: r.prospect.name,
          clientName: r.prospect.clientName,
          ownerName: r.prospect.owner.name,
          razaoSocial: r.razaoSocial,
          cnpj: r.cnpj,
          valor: Number(r.valor),
          condicaoPagamento: r.condicaoPagamento,
          createdAt: r.createdAt.toISOString(),
        }))}
        prospectOwners={prospectOwners.map((o) => ({ id: o.id, name: o.name }))}
      />
    </div>
  );
}
