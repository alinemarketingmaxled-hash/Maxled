import Link from "next/link";
import type { PurchaseStatus } from "@/generated/prisma/client";
import { requireView } from "@/lib/require-permission";
import { canEdit, canSeeCosts } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtMoney } from "@/lib/erp/format";
import { PURCHASE_STATUS_LABELS, purchaseTotal } from "@/lib/erp/purchasing";
import { PageHeader, Table, Tabs, thCls, tdCls, Badge, EmptyState, NoCompany, btnPrimary, btnSecondary } from "@/components/erp/ui";
import { PURCHASE_STATUS_TONE } from "@/components/erp/compras/status";

const TABS: { key: string; label: string; statuses: PurchaseStatus[] }[] = [
  { key: "solicitacoes", label: "Solicitações", statuses: ["SOLICITADO"] },
  { key: "cotacao", label: "Em cotação", statuses: ["COTACAO"] },
  { key: "aprovadas", label: "Aguardando recebimento", statuses: ["APROVADO"] },
  { key: "parcial", label: "Recebidas parcial", statuses: ["RECEBIDO_PARCIAL"] },
  { key: "recebidas", label: "Recebidas", statuses: ["RECEBIDO"] },
  { key: "canceladas", label: "Canceladas", statuses: ["CANCELADO"] },
];


export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const session = await requireView("compras");
  let companyId: string;
  try {
    companyId = (await getCompanyContext(session)).active.id;
  } catch {
    return <NoCompany />;
  }
  const { aba } = await searchParams;
  const tab = TABS.find((t) => t.key === aba) ?? TABS[0];
  const [counts, orders] = await Promise.all([
    prisma.purchaseOrder.groupBy({ by: ["status"], where: { companyId }, _count: true }),
    prisma.purchaseOrder.findMany({
      where: { companyId, status: { in: tab.statuses } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { supplier: { select: { name: true } }, items: { select: { quantity: true, receivedQty: true, unitCostForeign: true } } },
    }),
  ]);
  const countOf = (s: PurchaseStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);
  const costs = canSeeCosts(session.user.role);

  return (
    <div>
      <PageHeader
        title="Compras e importação"
        subtitle="Solicitação, cotação, aprovação, recebimento e custo de entrada."
        actions={
          <>
            <Link href="/compras/fornecedores" className={btnSecondary}>Fornecedores</Link>
            {canEdit(session.user.role, "compras") && <Link href="/compras/nova" className={btnPrimary}>Nova solicitação</Link>}
          </>
        }
      />
      <Tabs active={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/compras?aba=${t.key}`, count: countOf(t.statuses) }))} />
      {orders.length === 0 ? (
        <EmptyState>Nenhuma compra nesta etapa.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Compra</th>
              <th className={thCls}>Fornecedor</th>
              <th className={thCls}>Data</th>
              <th className={thCls}>Previsão</th>
              <th className={thCls}>Tipo</th>
              <th className={thCls}>Recebido</th>
              {costs && <th className={thCls}>Total (R$)</th>}
              <th className={thCls}>Status</th>
            </>
          }
        >
          {orders.map((po) => {
            const qty = po.items.reduce((s, i) => s + i.quantity, 0);
            const rec = po.items.reduce((s, i) => s + i.receivedQty, 0);
            return (
              <tr key={po.id}>
                <td className={tdCls}><Link href={`/compras/${po.id}`} className="font-semibold text-gold hover:underline">#{po.number}</Link></td>
                <td className={tdCls}>{po.supplier.name}</td>
                <td className={tdCls}>{fmtDate(po.createdAt)}</td>
                <td className={tdCls}>{fmtDate(po.expectedAt)}</td>
                <td className={tdCls}>{po.isImport ? `Importação (${po.currency})` : "Nacional"}</td>
                <td className={`${tdCls} tabular-nums`}>{rec}/{qty}</td>
                {costs && <td className={`${tdCls} tabular-nums`}>{fmtMoney(purchaseTotal(po).total)}</td>}
                <td className={tdCls}><Badge tone={PURCHASE_STATUS_TONE[po.status]}>{PURCHASE_STATUS_LABELS[po.status]}</Badge></td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
