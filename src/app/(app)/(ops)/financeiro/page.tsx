import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canApprovePayables, canEdit } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { addDays } from "@/lib/erp/money";
import { fmtMoney } from "@/lib/erp/format";
import { Kpi, NoCompany, PageHeader, Tabs } from "@/components/erp/ui";
import { ReceivablesTab, type FinParams } from "@/components/erp/financeiro/ReceivablesTab";
import { PayablesTab } from "@/components/erp/financeiro/PayablesTab";
import { CashFlowTab } from "@/components/erp/financeiro/CashFlowTab";
import { ReconciliationTab } from "@/components/erp/financeiro/ReconciliationTab";
import { BillingTab } from "@/components/erp/financeiro/BillingTab";
import { startOfToday } from "@/components/erp/financeiro/shared";

const TABS = [
  { key: "receber", label: "Contas a receber" },
  { key: "pagar", label: "Contas a pagar" },
  { key: "fluxo", label: "Fluxo de caixa" },
  { key: "conciliacao", label: "Conciliação" },
  { key: "faturamento", label: "Faturamento" },
];

const remaining = (agg: { _sum: { amount: { toNumber(): number } | null; paidAmount: { toNumber(): number } | null } }) =>
  (agg._sum.amount?.toNumber() ?? 0) - (agg._sum.paidAmount?.toNumber() ?? 0);

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<FinParams> }) {
  const session = await requireView("financeiro");
  const params = await searchParams;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const companyId = ctx.active.id;
  const editable = canEdit(session.user.role, "financeiro");
  const canApprove = canApprovePayables(session.user.role);
  const tab = TABS.some((t) => t.key === params.aba) ? params.aba! : "receber";

  const today = startOfToday();
  const in30 = addDays(today, 31);
  const openStatus = { in: ["ABERTO" as const, "PARCIAL" as const] };
  const sums = { _sum: { amount: true, paidAmount: true } } as const;
  const [rec30, pay30, overdue, allOpenRec] = await Promise.all([
    prisma.receivable.aggregate({ where: { companyId, status: openStatus, dueDate: { lt: in30 } }, ...sums }),
    prisma.payable.aggregate({ where: { companyId, status: openStatus, dueDate: { lt: in30 } }, ...sums }),
    prisma.receivable.aggregate({ where: { companyId, status: openStatus, dueDate: { lt: today } }, ...sums }),
    prisma.receivable.aggregate({ where: { companyId, status: openStatus }, ...sums }),
  ]);
  const overdueValue = remaining(overdue);
  const openValue = remaining(allOpenRec);
  const delinquency = openValue > 0 ? (overdueValue / openValue) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Financeiro" subtitle={`Empresa ${ctx.active.code} · ${ctx.active.tradeName || ctx.active.name}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="A receber em 30 dias" value={fmtMoney(remaining(rec30))} hint="inclui vencidos" />
        <Kpi label="A pagar em 30 dias" value={fmtMoney(remaining(pay30))} hint="inclui vencidos" />
        <Kpi label="Recebíveis vencidos" value={fmtMoney(overdueValue)} tone={overdueValue > 0 ? "critical" : undefined} />
        <Kpi label="Inadimplência" value={`${delinquency.toFixed(1)}%`} hint="vencido / total em aberto" tone={delinquency > 10 ? "warning" : undefined} />
      </div>

      <Tabs tabs={TABS.map((t) => ({ ...t, href: `/financeiro?aba=${t.key}` }))} active={tab} />

      {tab === "receber" && <ReceivablesTab companyId={companyId} companyCode={ctx.active.code} params={params} editable={editable} />}
      {tab === "pagar" && <PayablesTab companyId={companyId} sit={params.sit} editable={editable} canApprove={canApprove} />}
      {tab === "fluxo" && <CashFlowTab companyId={companyId} />}
      {tab === "conciliacao" && <ReconciliationTab companyId={companyId} pendingOnly={params.pend !== "0"} editable={editable} />}
      {tab === "faturamento" && <BillingTab companyId={companyId} companyCode={ctx.active.code} />}
    </div>
  );
}
