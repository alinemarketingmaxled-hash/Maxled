import "server-only";
import type { Session } from "next-auth";
import type { Prisma, SalesChannel, SalesOrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canSeeCosts, canView, getPermission } from "@/lib/permissions";
import { D } from "@/lib/erp/money";

/** Status que contam como venda: aprovado em diante, nunca cancelado. */
export const SOLD_STATUSES: SalesOrderStatus[] = [
  "APROVADO",
  "EM_SEPARACAO",
  "EM_CONFERENCIA",
  "PRONTO_EXPEDICAO",
  "ENVIADO",
  "ENTREGUE",
];

/** Vendedor (escopo "own" no painel ou em pedidos) só enxerga números dos
 * próprios pedidos. */
export function sellerFilter(session: Session): Prisma.SalesOrderWhereInput {
  const own =
    getPermission(session.user.role, "painel").scope === "own" ||
    getPermission(session.user.role, "pedidos").scope === "own";
  return own ? { sellerId: session.user.id } : {};
}

function monthStart(d: Date, offset = 0) {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(session: Session, companyIds: string[]) {
  const role = session.user.role;
  const now = new Date();
  const thisMonth = monthStart(now);
  const nextMonth = monthStart(now, 1);
  const sixMonthsAgo = monthStart(now, -5);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const in7 = new Date(today.getTime() + 8 * 86_400_000);

  const showSales = canView(role, "pedidos") || canView(role, "painel");
  const showStock = canView(role, "estoque");
  const showFinance = canView(role, "financeiro");
  const showFiscal = canView(role, "fiscal");
  const showCosts = canSeeCosts(role);

  const sold: Prisma.SalesOrderWhereInput = {
    companyId: { in: companyIds },
    status: { in: SOLD_STATUSES },
    ...sellerFilter(session),
  };

  const [periodOrders, activeClients, monthItems, pending, lowStockRaw, receivables, payables, fiscalRejected, approvedWithoutDoc] =
    await Promise.all([
      prisma.salesOrder.findMany({
        where: { ...sold, approvedAt: { gte: sixMonthsAgo, lt: nextMonth } },
        select: { companyId: true, total: true, approvedAt: true, channel: true },
      }),
      prisma.salesOrder.findMany({
        where: { ...sold, approvedAt: { gte: ninetyDaysAgo } },
        distinct: ["contactId"],
        select: { contactId: true, companyId: true },
      }),
      prisma.salesOrderItem.findMany({
        where: { order: { ...sold, approvedAt: { gte: thisMonth, lt: nextMonth } } },
        select: {
          quantity: true,
          subtotal: true,
          unitCost: true,
          productId: true,
          product: { select: { sku: true, name: true } },
        },
      }),
      prisma.salesOrder.groupBy({
        by: ["status"],
        where: {
          companyId: { in: companyIds },
          status: { in: ["AGUARDANDO_APROVACAO", "APROVADO", "EM_SEPARACAO", "EM_CONFERENCIA", "PRONTO_EXPEDICAO"] },
          ...sellerFilter(session),
        },
        _count: { _all: true },
      }),
      showStock
        ? prisma.$queryRaw<{ id: string; sku: string; name: string; available: number; minStock: number; companyId: string }[]>`
            SELECT p.id, p.sku, p.name, p."companyId",
                   (p."stockPhysical" - p."stockReserved" - p."stockBlocked")::int AS available, p."minStock"
            FROM "Product" p
            WHERE p."companyId" = ANY(${companyIds}) AND p."deletedAt" IS NULL AND p.active = true
              AND NOT EXISTS (SELECT 1 FROM "KitComponent" k WHERE k."kitId" = p.id)
              AND (p."stockPhysical" - p."stockReserved" - p."stockBlocked") < p."minStock"
            ORDER BY (p."stockPhysical" - p."stockReserved" - p."stockBlocked")::float / GREATEST(p."minStock", 1) ASC
            LIMIT 8`
        : Promise.resolve([]),
      showFinance
        ? prisma.receivable.findMany({
            where: { companyId: { in: companyIds }, status: { in: ["ABERTO", "PARCIAL"] }, dueDate: { lt: in7 } },
            select: { amount: true, paidAmount: true, dueDate: true },
          })
        : Promise.resolve([]),
      showFinance
        ? prisma.payable.findMany({
            where: { companyId: { in: companyIds }, status: { in: ["ABERTO", "PARCIAL"] }, dueDate: { lt: in7 } },
            select: { amount: true, paidAmount: true, dueDate: true },
          })
        : Promise.resolve([]),
      showFiscal
        ? prisma.fiscalDocument.count({ where: { companyId: { in: companyIds }, status: "REJEITADA", activeKey: { not: null } } })
        : Promise.resolve(0),
      showFiscal || showSales
        ? prisma.salesOrder.count({
            where: {
              ...sold,
              status: { in: ["APROVADO", "EM_SEPARACAO", "EM_CONFERENCIA", "PRONTO_EXPEDICAO"] },
              fiscalDocuments: { none: { status: "AUTORIZADA" } },
            },
          })
        : Promise.resolve(0),
    ]);

  // Vendas do mês por empresa (consolidado mostra cada uma separada).
  const byCompany = new Map<string, { revenue: number; orders: number }>();
  const monthly = new Map<string, number>();
  const byChannel = new Map<SalesChannel, { revenue: number; orders: number }>();
  for (let i = 0; i < 6; i++) {
    const m = monthStart(now, -5 + i);
    monthly.set(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const o of periodOrders) {
    if (!o.approvedAt) continue;
    const key = `${o.approvedAt.getFullYear()}-${String(o.approvedAt.getMonth() + 1).padStart(2, "0")}`;
    const total = Number(o.total);
    monthly.set(key, (monthly.get(key) ?? 0) + total);
    if (o.approvedAt >= thisMonth) {
      const c = byCompany.get(o.companyId) ?? { revenue: 0, orders: 0 };
      c.revenue += total;
      c.orders += 1;
      byCompany.set(o.companyId, c);
      const ch = byChannel.get(o.channel) ?? { revenue: 0, orders: 0 };
      ch.revenue += total;
      ch.orders += 1;
      byChannel.set(o.channel, ch);
    }
  }
  const revenue = [...byCompany.values()].reduce((s, c) => s + c.revenue, 0);
  const orders = [...byCompany.values()].reduce((s, c) => s + c.orders, 0);

  const productAgg = new Map<string, { sku: string; name: string; qty: number; revenue: number }>();
  let itemsRevenue = D(0);
  let itemsCost = D(0);
  for (const it of monthItems) {
    const p = productAgg.get(it.productId) ?? { sku: it.product.sku, name: it.product.name, qty: 0, revenue: 0 };
    p.qty += it.quantity;
    p.revenue += Number(it.subtotal);
    productAgg.set(it.productId, p);
    itemsRevenue = itemsRevenue.add(it.subtotal);
    itemsCost = itemsCost.add(D(it.unitCost).mul(it.quantity));
  }
  // Margem só com custo confiável: itens sem custo (0) zeram a confiança.
  const hasZeroCost = monthItems.some((i) => D(i.unitCost).isZero());

  const pendingCount = (s: SalesOrderStatus) => pending.find((p) => p.status === s)?._count._all ?? 0;

  const sumOpen = (rows: { amount: Prisma.Decimal; paidAmount: Prisma.Decimal; dueDate: Date }[]) => {
    let overdue = 0;
    let next7 = 0;
    for (const r of rows) {
      const open = Number(r.amount) - Number(r.paidAmount);
      if (r.dueDate < today) overdue += open;
      else next7 += open;
    }
    return { overdue, next7 };
  };

  return {
    show: { sales: showSales, stock: showStock, finance: showFinance, fiscal: showFiscal, costs: showCosts },
    revenue,
    orders,
    ticket: orders > 0 ? revenue / orders : 0,
    activeClients: activeClients.length,
    byCompany: [...byCompany.entries()].map(([companyId, v]) => ({ companyId, ...v })),
    activeClientsByCompany: companyIds.map((id) => ({
      companyId: id,
      count: activeClients.filter((a) => a.companyId === id).length,
    })),
    monthly: [...monthly.entries()].map(([month, value]) => ({ month, value })),
    byChannel: [...byChannel.entries()].map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.revenue - a.revenue),
    topProducts: [...productAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    margin:
      showCosts && itemsRevenue.greaterThan(0)
        ? {
            revenue: itemsRevenue.toNumber(),
            cost: itemsCost.toNumber(),
            pct: itemsRevenue.sub(itemsCost).div(itemsRevenue).mul(100).toNumber(),
            reliable: !hasZeroCost,
          }
        : null,
    pending: {
      approval: pendingCount("AGUARDANDO_APROVACAO"),
      toPick: pendingCount("APROVADO") + pendingCount("EM_SEPARACAO") + pendingCount("EM_CONFERENCIA"),
      readyToShip: pendingCount("PRONTO_EXPEDICAO"),
      withoutInvoice: approvedWithoutDoc,
    },
    lowStock: lowStockRaw,
    receivables: sumOpen(receivables),
    payables: sumOpen(payables),
    fiscal: { rejected: fiscalRejected, withoutInvoice: approvedWithoutDoc },
  };
}
