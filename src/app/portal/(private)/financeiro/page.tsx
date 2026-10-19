import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer, companyLabel } from "@/lib/erp/portal";
import { EmptyState, Kpi, PageHeader, Table, Tabs, tdCls, thCls } from "@/components/erp/ui";
import { fmtDate, fmtMoney, orderCode } from "@/lib/erp/format";
import { TitleStatusBadge } from "@/components/portal/badges";
import { D } from "@/lib/erp/money";
import type { Prisma } from "@/generated/prisma/client";

const FILTERS = ["abertos", "vencidos", "pagos", "todos"] as const;
type Filter = (typeof FILTERS)[number];

export default async function PortalFinance({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { contactId } = await requireCustomer();
  const { f } = await searchParams;
  const filter: Filter = FILTERS.includes(f as Filter) ? (f as Filter) : "abertos";
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const base: Prisma.ReceivableWhereInput = { contactId, status: { not: "CANCELADO" } };
  const where: Prisma.ReceivableWhereInput =
    filter === "abertos"
      ? { ...base, status: { in: ["ABERTO", "PARCIAL"] } }
      : filter === "vencidos"
        ? { ...base, status: { in: ["ABERTO", "PARCIAL"] }, dueDate: { lt: today } }
        : filter === "pagos"
          ? { ...base, status: "PAGO" }
          : base;

  const [rows, open] = await Promise.all([
    prisma.receivable.findMany({
      where,
      orderBy: { dueDate: filter === "pagos" ? "desc" : "asc" },
      take: 300,
      select: {
        id: true, description: true, installment: true, installmentsTotal: true, amount: true, paidAmount: true,
        dueDate: true, status: true, paymentMethod: true,
        order: { select: { id: true, number: true } },
        company: { select: { code: true, name: true, tradeName: true } },
      },
    }),
    prisma.receivable.findMany({
      where: { contactId, status: { in: ["ABERTO", "PARCIAL"] } },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
  ]);

  const openTotal = open.reduce((s, r) => s.add(r.amount.sub(r.paidAmount)), D(0));
  const overdueTotal = open.filter((r) => r.dueDate < today).reduce((s, r) => s.add(r.amount.sub(r.paidAmount)), D(0));

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Parcelas dos seus pedidos faturados." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Kpi label="Total em aberto" value={fmtMoney(openTotal.toNumber())} />
        <Kpi label="Vencido" value={fmtMoney(overdueTotal.toNumber())} tone={overdueTotal.greaterThan(0) ? "critical" : undefined} />
      </div>
      <Tabs
        active={filter}
        tabs={[
          { key: "abertos", label: "Em aberto", href: "/portal/financeiro?f=abertos" },
          { key: "vencidos", label: "Vencidos", href: "/portal/financeiro?f=vencidos" },
          { key: "pagos", label: "Pagos", href: "/portal/financeiro?f=pagos" },
          { key: "todos", label: "Todos", href: "/portal/financeiro?f=todos" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState>Nenhuma parcela neste filtro.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Descrição</th>
              <th className={thCls}>Emitente</th>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Vencimento</th>
              <th className={thCls}>Valor</th>
              <th className={thCls}>Pago</th>
              <th className={thCls}>Status</th>
            </>
          }
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={tdCls}>
                Parcela {r.installment}/{r.installmentsTotal}
                {r.paymentMethod && <span className="block text-[11px] text-ink-muted">{r.paymentMethod}</span>}
              </td>
              <td className={tdCls}>{companyLabel(r.company)}</td>
              <td className={tdCls}>
                {r.order ? (
                  <Link href={`/portal/pedidos/${r.order.id}`} className="text-gold hover:underline">
                    {orderCode(r.company.code, r.order.number)}
                  </Link>
                ) : (
                  "-"
                )}
              </td>
              <td className={tdCls}>{fmtDate(r.dueDate)}</td>
              <td className={`${tdCls} tabular-nums`}>{fmtMoney(r.amount.toString())}</td>
              <td className={`${tdCls} tabular-nums`}>{fmtMoney(r.paidAmount.toString())}</td>
              <td className={tdCls}>
                <TitleStatusBadge status={r.status} dueDate={r.dueDate} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
