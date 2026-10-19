import "server-only";
import type { Session } from "next-auth";
import type { Prisma, SalesChannel, SalesOrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canSeeCosts, canView, getPermission, type Module } from "@/lib/permissions";
import { CHANNEL_LABELS, ORDER_STATUS_LABELS } from "@/lib/erp/orders";
import { FISCAL_STATUS_LABELS } from "@/lib/erp/fiscal";
import { SOLD_STATUSES } from "@/lib/erp/dashboard";
import { MOVEMENT_LABELS } from "@/lib/erp/stock";
import { D } from "@/lib/erp/money";

export type ReportTab = "vendas" | "produtos" | "mercadolivre" | "compras" | "fiscal" | "financeiro";

export const REPORT_TABS: { key: ReportTab; label: string; module: Module }[] = [
  { key: "vendas", label: "Vendas", module: "pedidos" },
  { key: "produtos", label: "Produtos e estoque", module: "produtos" },
  { key: "mercadolivre", label: "Mercado Livre e kits", module: "pedidos" },
  { key: "compras", label: "Compras", module: "compras" },
  { key: "fiscal", label: "Fiscal", module: "fiscal" },
  { key: "financeiro", label: "Financeiro", module: "financeiro" },
];

/** Cada aba exige ver o módulo de origem dos dados, além de Relatórios.
 * Vendedor (escopo próprio em Relatórios) vê Vendas mesmo sem ver Pedidos
 * de todos — os números já vêm filtrados pelos seus pedidos. */
export function allowedTabs(session: Session) {
  const role = session.user.role;
  return REPORT_TABS.filter((t) => canView(role, "relatorios") && canView(role, t.module));
}

export type ColKind = "text" | "money" | "int" | "pct" | "date";
export type ReportTable = { title: string; headers: string[]; kinds: ColKind[]; rows: (string | number | null)[][]; note?: string };
export type ReportKpi = { label: string; value: number | string; kind: ColKind; hint?: string };
export type ReportResult = { kpis: ReportKpi[]; tables: ReportTable[] };

export type ReportFilters = {
  from: Date;
  to: Date; // exclusivo
  sellerId?: string;
  contactId?: string;
  productId?: string;
  family?: string;
  channel?: SalesChannel;
  status?: SalesOrderStatus;
};

export function parseFilters(sp: Record<string, string | undefined>): ReportFilters & { fromStr: string; toStr: string } {
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const parse = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);
  let from = parse(sp.de) ?? defFrom;
  const toIncl = parse(sp.ate) ?? now;
  // Limita o período a 3 anos para manter as consultas leves.
  if (toIncl.getTime() - from.getTime() > 3 * 366 * 86_400_000) from = new Date(toIncl.getTime() - 3 * 366 * 86_400_000);
  const to = new Date(toIncl.getFullYear(), toIncl.getMonth(), toIncl.getDate() + 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from,
    to,
    fromStr: iso(from),
    toStr: iso(toIncl),
    sellerId: sp.vendedor || undefined,
    contactId: sp.cliente || undefined,
    productId: sp.produto || undefined,
    family: sp.familia || undefined,
    channel: sp.canal && sp.canal in CHANNEL_LABELS ? (sp.canal as SalesChannel) : undefined,
    status: sp.status && sp.status in ORDER_STATUS_LABELS ? (sp.status as SalesOrderStatus) : undefined,
  };
}

function ownOnly(session: Session) {
  return getPermission(session.user.role, "relatorios").scope === "own" || getPermission(session.user.role, "pedidos").scope === "own";
}

function orderWhere(session: Session, companyIds: string[], f: ReportFilters, dateField: "approvedAt" | "createdAt" = "approvedAt"): Prisma.SalesOrderWhereInput {
  const itemFilter: Prisma.SalesOrderItemWhereInput | null = f.productId
    ? { productId: f.productId }
    : f.family
      ? { product: { family: f.family } }
      : null;
  return {
    companyId: { in: companyIds },
    ...(ownOnly(session) ? { sellerId: session.user.id } : f.sellerId ? { sellerId: f.sellerId } : {}),
    ...(f.contactId ? { contactId: f.contactId } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(dateField === "approvedAt" ? { status: f.status ? f.status : { in: SOLD_STATUSES } } : {}),
    [dateField]: { gte: f.from, lt: f.to },
    ...(itemFilter ? { items: { some: itemFilter } } : {}),
  };
}

function itemWhere(f: ReportFilters): Prisma.SalesOrderItemWhereInput {
  return f.productId ? { productId: f.productId } : f.family ? { product: { family: f.family } } : {};
}

const contactName = (c: { firstName: string; lastName: string; accountName: string | null }) =>
  c.accountName || `${c.firstName} ${c.lastName}`.trim();

export async function runReport(
  session: Session,
  tab: ReportTab,
  companyIds: string[],
  f: ReportFilters,
  companyLabel: (id: string) => string,
): Promise<ReportResult> {
  switch (tab) {
    case "vendas":
      return salesReport(session, companyIds, f, companyLabel);
    case "produtos":
      return productsReport(session, companyIds, f);
    case "mercadolivre":
      return marketplaceReport(session, companyIds, f);
    case "compras":
      return purchasesReport(companyIds, f);
    case "fiscal":
      return fiscalReport(companyIds, f);
    case "financeiro":
      return financeReport(companyIds, f, companyLabel);
  }
}

async function salesReport(session: Session, companyIds: string[], f: ReportFilters, companyLabel: (id: string) => string): Promise<ReportResult> {
  const [orders, created] = await Promise.all([
    prisma.salesOrder.findMany({
      where: orderWhere(session, companyIds, f),
      select: {
        companyId: true, total: true, channel: true, approvedAt: true,
        seller: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, accountName: true } },
      },
    }),
    prisma.salesOrder.findMany({
      where: orderWhere(session, companyIds, { ...f, status: undefined }, "createdAt"),
      select: { status: true },
    }),
  ]);

  const total = orders.reduce((s, o) => s + Number(o.total), 0);
  const converted = created.filter((o) => (SOLD_STATUSES as string[]).includes(o.status)).length;

  const group = <K extends string>(key: (o: (typeof orders)[number]) => K, label: (o: (typeof orders)[number]) => string) => {
    const m = new Map<K, { label: string; n: number; total: number; last: Date | null }>();
    for (const o of orders) {
      const k = key(o);
      const g = m.get(k) ?? { label: label(o), n: 0, total: 0, last: null };
      g.n += 1;
      g.total += Number(o.total);
      if (o.approvedAt && (!g.last || o.approvedAt > g.last)) g.last = o.approvedAt;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  const tables: ReportTable[] = [];
  if (companyIds.length > 1) {
    tables.push({
      title: "Por empresa",
      headers: ["Empresa", "Pedidos", "Total", "Ticket médio"],
      kinds: ["text", "int", "money", "money"],
      rows: group((o) => o.companyId, (o) => companyLabel(o.companyId)).map((g) => [g.label, g.n, g.total, g.total / g.n]),
    });
  }
  if (!ownOnly(session)) {
    tables.push({
      title: "Por vendedor",
      headers: ["Vendedor", "Pedidos", "Total", "Ticket médio"],
      kinds: ["text", "int", "money", "money"],
      rows: group((o) => o.seller.id, (o) => o.seller.name).map((g) => [g.label, g.n, g.total, g.total / g.n]),
    });
  }
  tables.push({
    title: "Por canal",
    headers: ["Canal", "Pedidos", "Total", "Participação"],
    kinds: ["text", "int", "money", "pct"],
    rows: group((o) => o.channel, (o) => CHANNEL_LABELS[o.channel]).map((g) => [g.label, g.n, g.total, total > 0 ? (g.total / total) * 100 : 0]),
  });
  tables.push({
    title: "Por cliente (carteira)",
    headers: ["Cliente", "Pedidos", "Total", "Último pedido"],
    kinds: ["text", "int", "money", "date"],
    rows: group((o) => o.contact.id, (o) => contactName(o.contact))
      .slice(0, 100)
      .map((g) => [g.label, g.n, g.total, g.last ? g.last.toISOString() : null]),
    note: "Até 100 clientes, por valor.",
  });

  return {
    kpis: [
      { label: "Total vendido", value: total, kind: "money" },
      { label: "Pedidos aprovados", value: orders.length, kind: "int" },
      { label: "Ticket médio", value: orders.length ? total / orders.length : 0, kind: "money" },
      {
        label: "Conversão cotação → pedido",
        value: created.length ? (converted / created.length) * 100 : 0,
        kind: "pct",
        hint: `${converted} de ${created.length} criados no período`,
      },
    ],
    tables,
  };
}

async function productsReport(session: Session, companyIds: string[], f: ReportFilters): Promise<ReportResult> {
  const costs = canSeeCosts(session.user.role);
  const productFilter: Prisma.ProductWhereInput = {
    companyId: { in: companyIds },
    deletedAt: null,
    ...(f.productId ? { id: f.productId } : {}),
    ...(f.family ? { family: f.family } : {}),
  };
  const [items, products] = await Promise.all([
    prisma.salesOrderItem.findMany({
      where: { ...itemWhere(f), order: orderWhere(session, companyIds, f) },
      select: { productId: true, quantity: true, subtotal: true, unitCost: true },
    }),
    prisma.product.findMany({
      where: productFilter,
      select: {
        id: true, sku: true, name: true, family: true, cost: true, minStock: true,
        stockPhysical: true, stockReserved: true, stockBlocked: true,
        _count: { select: { components: true } },
      },
    }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const agg = new Map<string, { qty: number; revenue: Prisma.Decimal; cost: Prisma.Decimal }>();
  for (const it of items) {
    const a = agg.get(it.productId) ?? { qty: 0, revenue: D(0), cost: D(0) };
    a.qty += it.quantity;
    a.revenue = a.revenue.add(it.subtotal);
    a.cost = a.cost.add(D(it.unitCost).mul(it.quantity));
    agg.set(it.productId, a);
  }
  const totalRevenue = [...agg.values()].reduce((s, a) => s.add(a.revenue), D(0));
  const totalCost = [...agg.values()].reduce((s, a) => s.add(a.cost), D(0));

  const top = [...agg.entries()]
    .map(([id, a]) => ({ p: byId.get(id), a }))
    .filter((x) => x.p)
    .sort((x, y) => y.a.revenue.comparedTo(x.a.revenue));

  const available = (p: (typeof products)[number]) => p.stockPhysical - p.stockReserved - p.stockBlocked;
  const simple = products.filter((p) => p._count.components === 0);

  const topHeaders = ["SKU", "Produto", "Família", "Qtd vendida", "Receita", "Giro"];
  const topKinds: ColKind[] = ["text", "text", "text", "int", "money", "text"];
  if (costs) {
    topHeaders.push("Custo", "Margem");
    topKinds.push("money", "pct");
  }

  const stopped = simple
    .filter((p) => p.stockPhysical > 0 && !agg.has(p.id))
    .sort((a, b) => D(b.cost).mul(b.stockPhysical).comparedTo(D(a.cost).mul(a.stockPhysical)) || b.stockPhysical - a.stockPhysical);
  const ruptures = simple.filter((p) => available(p) <= 0 || available(p) < p.minStock).sort((a, b) => available(a) - available(b));

  const kpis: ReportKpi[] = [
    { label: "Receita de itens", value: totalRevenue.toNumber(), kind: "money" },
    { label: "Produtos vendidos", value: agg.size, kind: "int" },
    { label: "Produtos parados", value: stopped.length, kind: "int", hint: "com saldo e sem venda no período" },
    { label: "Rupturas / abaixo do mínimo", value: ruptures.length, kind: "int" },
  ];
  if (costs && totalRevenue.greaterThan(0)) {
    kpis.splice(1, 0, { label: "Margem bruta", value: totalRevenue.sub(totalCost).div(totalRevenue).mul(100).toNumber(), kind: "pct" });
  }

  return {
    kpis,
    tables: [
      {
        title: "Mais vendidos",
        headers: topHeaders,
        kinds: topKinds,
        rows: top.slice(0, 100).map(({ p, a }) => {
          const turnover = p!.stockPhysical > 0 ? (a.qty / p!.stockPhysical).toFixed(2).replace(".", ",") + "x" : p!._count.components > 0 ? "kit" : "sem saldo";
          const row: (string | number | null)[] = [p!.sku, p!.name, p!.family, a.qty, a.revenue.toNumber(), turnover];
          if (costs) {
            row.push(a.cost.toNumber(), a.revenue.greaterThan(0) ? a.revenue.sub(a.cost).div(a.revenue).mul(100).toNumber() : 0);
          }
          return row;
        }),
        note: "Giro = quantidade vendida no período / saldo físico atual (aproximado).",
      },
      {
        title: "Produtos parados",
        headers: costs ? ["SKU", "Produto", "Família", "Saldo físico", "Valor em estoque"] : ["SKU", "Produto", "Família", "Saldo físico"],
        kinds: costs ? ["text", "text", "text", "int", "money"] : ["text", "text", "text", "int"],
        rows: stopped.slice(0, 200).map((p) => {
          const r: (string | number)[] = [p.sku, p.name, p.family, p.stockPhysical];
          if (costs) r.push(D(p.cost).mul(p.stockPhysical).toNumber());
          return r;
        }),
      },
      {
        title: "Rupturas e saldo abaixo do mínimo",
        headers: ["SKU", "Produto", "Físico", "Reservado", "Bloqueado", "Disponível", "Mínimo"],
        kinds: ["text", "text", "int", "int", "int", "int", "int"],
        rows: ruptures.slice(0, 200).map((p) => [p.sku, p.name, p.stockPhysical, p.stockReserved, p.stockBlocked, available(p), p.minStock]),
      },
    ],
  };
}

async function marketplaceReport(session: Session, companyIds: string[], f: ReportFilters): Promise<ReportResult> {
  const [mlOrders, kitItems, divergences, listings] = await Promise.all([
    prisma.salesOrder.findMany({
      where: orderWhere(session, companyIds, { ...f, channel: "MERCADO_LIVRE" }),
      select: { total: true },
    }),
    prisma.salesOrderItem.findMany({
      where: { ...itemWhere(f), product: { components: { some: {} } }, order: orderWhere(session, companyIds, f) },
      select: { quantity: true, subtotal: true, product: { select: { id: true, sku: true, name: true, components: { select: { quantity: true, component: { select: { sku: true } } } } } } },
    }),
    prisma.stockMovement.findMany({
      where: {
        companyId: { in: companyIds },
        type: { in: ["BLOQUEIO", "AJUSTE_NEGATIVO", "AJUSTE_POSITIVO"] },
        createdAt: { gte: f.from, lt: f.to },
        ...(f.productId ? { productId: f.productId } : f.family ? { product: { family: f.family } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { createdAt: true, type: true, quantity: true, reason: true, product: { select: { sku: true, name: true } }, user: { select: { name: true } } },
    }),
    prisma.marketplaceListing.count({ where: { companyId: { in: companyIds }, channel: "MERCADO_LIVRE", active: true } }),
  ]);
  const kitAgg = new Map<string, { sku: string; name: string; kits: number; revenue: number; parts: string }>();
  for (const it of kitItems) {
    const k = kitAgg.get(it.product.id) ?? {
      sku: it.product.sku,
      name: it.product.name,
      kits: 0,
      revenue: 0,
      parts: it.product.components.map((c) => `${c.quantity}x ${c.component.sku}`).join(", "),
    };
    k.kits += it.quantity;
    k.revenue += Number(it.subtotal);
    kitAgg.set(it.product.id, k);
  }
  const mlTotal = mlOrders.reduce((s, o) => s + Number(o.total), 0);
  return {
    kpis: [
      { label: "Vendas Mercado Livre", value: mlTotal, kind: "money" },
      { label: "Pedidos Mercado Livre", value: mlOrders.length, kind: "int" },
      { label: "Anúncios ativos", value: listings, kind: "int" },
      { label: "Ajustes/bloqueios no período", value: divergences.length, kind: "int" },
    ],
    tables: [
      {
        title: "Kits vendidos (baixa nos componentes)",
        headers: ["SKU do kit", "Kit", "Kits vendidos", "Receita", "Composição"],
        kinds: ["text", "text", "int", "money", "text"],
        rows: [...kitAgg.values()].sort((a, b) => b.revenue - a.revenue).map((k) => [k.sku, k.name, k.kits, k.revenue, k.parts]),
      },
      {
        title: "Divergências de estoque (ajustes e bloqueios)",
        headers: ["Data", "SKU", "Produto", "Tipo", "Qtd", "Motivo", "Usuário"],
        kinds: ["date", "text", "text", "text", "int", "text", "text"],
        rows: divergences.map((d) => [d.createdAt.toISOString(), d.product.sku, d.product.name, MOVEMENT_LABELS[d.type], d.quantity, d.reason ?? "", d.user?.name ?? "Sistema"]),
        note: "Até 300 movimentos mais recentes.",
      },
    ],
  };
}

async function purchasesReport(companyIds: string[], f: ReportFilters): Promise<ReportResult> {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      companyId: { in: companyIds },
      createdAt: { gte: f.from, lt: f.to },
      status: { not: "CANCELADO" },
      ...(f.productId ? { items: { some: { productId: f.productId } } } : f.family ? { items: { some: { product: { family: f.family } } } } : {}),
    },
    select: {
      status: true, isImport: true, exchangeRate: true, freight: true, insurance: true, customsExpenses: true, importTaxes: true, otherExpenses: true,
      supplier: { select: { id: true, name: true, rating: true } },
      items: { select: { quantity: true, receivedQty: true, unitCostForeign: true, landedUnitCost: true } },
    },
  });
  const bySupplier = new Map<string, { name: string; rating: number | null; n: number; ordered: number; received: number; imports: number }>();
  let ordered = 0;
  let received = 0;
  for (const po of pos) {
    const rate = D(po.exchangeRate);
    const expenses = D(po.freight).add(po.insurance).add(po.customsExpenses).add(po.importTaxes).add(po.otherExpenses);
    const goods = po.items.reduce((s, i) => s.add(D(i.unitCostForeign).mul(i.quantity).mul(rate)), D(0));
    const rec = po.items.reduce((s, i) => s.add(D(i.landedUnitCost ?? D(i.unitCostForeign).mul(rate)).mul(i.receivedQty)), D(0));
    const value = goods.add(expenses).toNumber();
    const g = bySupplier.get(po.supplier.id) ?? { name: po.supplier.name, rating: po.supplier.rating, n: 0, ordered: 0, received: 0, imports: 0 };
    g.n += 1;
    g.ordered += value;
    g.received += rec.toNumber();
    if (po.isImport) g.imports += 1;
    bySupplier.set(po.supplier.id, g);
    ordered += value;
    received += rec.toNumber();
  }
  return {
    kpis: [
      { label: "Pedidos de compra", value: pos.length, kind: "int" },
      { label: "Valor comprado (com despesas)", value: ordered, kind: "money" },
      { label: "Valor recebido", value: received, kind: "money" },
      { label: "Importações", value: pos.filter((p) => p.isImport).length, kind: "int" },
    ],
    tables: [
      {
        title: "Por fornecedor",
        headers: ["Fornecedor", "Avaliação", "Pedidos", "Importações", "Valor comprado", "Valor recebido"],
        kinds: ["text", "text", "int", "int", "money", "money"],
        rows: [...bySupplier.values()]
          .sort((a, b) => b.ordered - a.ordered)
          .map((g) => [g.name, g.rating ? `${g.rating}/5` : "-", g.n, g.imports, g.ordered, g.received]),
        note: "Valores em R$ pela taxa de câmbio do pedido; recebido pelo custo final (landed) quando disponível.",
      },
    ],
  };
}

async function fiscalReport(companyIds: string[], f: ReportFilters): Promise<ReportResult> {
  const [byStatus, rejections] = await Promise.all([
    prisma.fiscalDocument.groupBy({
      by: ["status"],
      where: { companyId: { in: companyIds }, createdAt: { gte: f.from, lt: f.to } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.fiscalDocument.findMany({
      where: { companyId: { in: companyIds }, createdAt: { gte: f.from, lt: f.to }, rejectionCode: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { number: true, series: true, status: true, rejectionCode: true, rejectionReason: true, updatedAt: true, attempts: true, order: { select: { number: true } } },
    }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    kpis: [
      { label: "Autorizadas", value: count("AUTORIZADA"), kind: "int" },
      { label: "Rejeitadas pendentes", value: count("REJEITADA"), kind: "int" },
      { label: "Canceladas", value: count("CANCELADA"), kind: "int" },
      { label: "Valor autorizado", value: Number(byStatus.find((b) => b.status === "AUTORIZADA")?._sum.totalAmount ?? 0), kind: "money" },
    ],
    tables: [
      {
        title: "Documentos por status",
        headers: ["Status", "Quantidade", "Valor"],
        kinds: ["text", "int", "money"],
        rows: byStatus.map((b) => [FISCAL_STATUS_LABELS[b.status], b._count._all, Number(b._sum.totalAmount ?? 0)]),
      },
      {
        title: "Rejeições",
        headers: ["Nota", "Pedido", "Situação atual", "Código", "Motivo", "Tentativas", "Atualizada em"],
        kinds: ["text", "int", "text", "text", "text", "int", "date"],
        rows: rejections.map((r) => [
          `${r.series}/${r.number ?? "-"}`,
          r.order.number,
          FISCAL_STATUS_LABELS[r.status],
          r.rejectionCode ?? "",
          r.rejectionReason ?? "",
          r.attempts,
          r.updatedAt.toISOString(),
        ]),
        note: "Notas com rejeição registrada (inclui as que depois foram autorizadas no reenvio).",
      },
    ],
  };
}

async function financeReport(companyIds: string[], f: ReportFilters, companyLabel: (id: string) => string): Promise<ReportResult> {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const [inPaid, outPaid, dueInPeriod, overdue] = await Promise.all([
    prisma.receivablePayment.findMany({
      where: { receivable: { companyId: { in: companyIds } }, paidAt: { gte: f.from, lt: f.to } },
      select: { amount: true, reconciled: true, receivable: { select: { companyId: true } } },
    }),
    prisma.payablePayment.findMany({
      where: { payable: { companyId: { in: companyIds } }, paidAt: { gte: f.from, lt: f.to } },
      select: { amount: true, reconciled: true, payable: { select: { companyId: true } } },
    }),
    prisma.receivable.findMany({
      where: { companyId: { in: companyIds }, status: { not: "CANCELADO" }, dueDate: { gte: f.from, lt: f.to } },
      select: { amount: true, paidAmount: true, dueDate: true, status: true },
    }),
    prisma.receivable.findMany({
      where: {
        companyId: { in: companyIds },
        status: { in: ["ABERTO", "PARCIAL"] },
        dueDate: { lt: today },
        ...(f.contactId ? { contactId: f.contactId } : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 300,
      select: {
        companyId: true, description: true, amount: true, paidAmount: true, dueDate: true,
        contact: { select: { firstName: true, lastName: true, accountName: true } },
      },
    }),
  ]);
  const sum = (rows: { amount: Prisma.Decimal }[]) => rows.reduce((s, r) => s + Number(r.amount), 0);
  const received = sum(inPaid);
  const paid = sum(outPaid);
  const dueTotal = dueInPeriod.reduce((s, r) => s + Number(r.amount), 0);
  const dueOverdueOpen = dueInPeriod
    .filter((r) => r.dueDate < today && (r.status === "ABERTO" || r.status === "PARCIAL"))
    .reduce((s, r) => s + Number(r.amount) - Number(r.paidAmount), 0);
  const overdueTotal = overdue.reduce((s, r) => s + Number(r.amount) - Number(r.paidAmount), 0);

  const perCompany = companyIds.map((id) => {
    const rIn = inPaid.filter((p) => p.receivable.companyId === id);
    const rOut = outPaid.filter((p) => p.payable.companyId === id);
    return [
      companyLabel(id),
      sum(rIn),
      sum(rOut),
      sum(rIn) - sum(rOut),
      rIn.filter((p) => !p.reconciled).length + rOut.filter((p) => !p.reconciled).length,
    ];
  });

  return {
    kpis: [
      { label: "Recebido no período", value: received, kind: "money" },
      { label: "Pago no período", value: paid, kind: "money" },
      { label: "A receber vencido (hoje)", value: overdueTotal, kind: "money" },
      {
        label: "Inadimplência do período",
        value: dueTotal > 0 ? (dueOverdueOpen / dueTotal) * 100 : 0,
        kind: "pct",
        hint: "vencido em aberto / total com vencimento no período",
      },
    ],
    tables: [
      {
        title: "Caixa realizado por empresa",
        headers: ["Empresa", "Entradas", "Saídas", "Saldo", "Baixas não conciliadas"],
        kinds: ["text", "money", "money", "money", "int"],
        rows: perCompany,
      },
      {
        title: "Títulos vencidos em aberto",
        headers: ["Cliente", "Descrição", "Vencimento", "Saldo", "Dias em atraso"],
        kinds: ["text", "text", "date", "money", "int"],
        rows: overdue.map((r) => [
          contactName(r.contact),
          r.description,
          r.dueDate.toISOString(),
          Number(r.amount) - Number(r.paidAmount),
          Math.floor((today.getTime() - r.dueDate.getTime()) / 86_400_000),
        ]),
        note: "Posição atual, independente do período. Até 300 títulos.",
      },
    ],
  };
}

/** CSV para Excel pt-BR: BOM UTF-8, separador ";" e vírgula decimal. */
export function reportToCsv(result: ReportResult) {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cell = (v: string | number | null, kind: ColKind) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") {
      if (kind === "int") return String(Math.round(v));
      return v.toFixed(2).replace(".", ",");
    }
    if (kind === "date") return new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return esc(v);
  };
  const lines: string[] = [];
  lines.push("Indicador;Valor");
  for (const k of result.kpis) lines.push(`${esc(k.label)};${cell(k.value, k.kind)}`);
  for (const t of result.tables) {
    lines.push("", esc(t.title), t.headers.map(esc).join(";"));
    for (const r of t.rows) lines.push(r.map((v, i) => cell(v, t.kinds[i])).join(";"));
  }
  return "﻿" + lines.join("\r\n");
}
