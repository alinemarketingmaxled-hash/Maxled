import "server-only";
import type { Session } from "next-auth";
import { Prisma, type SalesOrderStatus, type SalesChannel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canApproveOrders, canEdit, getPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { applyMovement, explodeKit, StockError } from "@/lib/erp/stock";
import { cancelOpenReceivablesForOrder } from "@/lib/erp/finance";
import { D, lineSubtotal, round2 } from "@/lib/erp/money";

type Tx = Prisma.TransactionClient;

export class OrderError extends Error {}

export const ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  COTACAO: "Cotação",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado (estoque reservado)",
  EM_SEPARACAO: "Em separação",
  EM_CONFERENCIA: "Em conferência",
  PRONTO_EXPEDICAO: "Pronto para expedição",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  DIRETO: "Venda direta",
  MERCADO_LIVRE: "Mercado Livre",
  PORTAL: "Portal do cliente",
  OUTRO: "Outro",
};

/** Ordem do fluxo (§4.6/§5) — usada para saber se um pedido "já passou" de
 * uma etapa. CANCELADO fica fora. */
export const ORDER_FLOW: SalesOrderStatus[] = [
  "COTACAO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "EM_SEPARACAO",
  "EM_CONFERENCIA",
  "PRONTO_EXPEDICAO",
  "ENVIADO",
  "ENTREGUE",
];

export function reachedStatus(status: SalesOrderStatus, target: SalesOrderStatus) {
  if (status === "CANCELADO") return false;
  return ORDER_FLOW.indexOf(status) >= ORDER_FLOW.indexOf(target);
}

/** Pedidos visíveis: sempre da empresa ativa; vendedor ("own") só os seus. */
export function orderScopeWhere(session: Session, companyId: string): Prisma.SalesOrderWhereInput {
  const { scope } = getPermission(session.user.role, "pedidos");
  return { companyId, ...(scope === "own" ? { sellerId: session.user.id } : {}) };
}

/** Clientes que o usuário pode usar num pedido — a carteira do vendedor ou
 * todos, conforme o escopo de Pedidos. */
export function orderContactScope(session: Session): Prisma.ContactWhereInput {
  const { scope } = getPermission(session.user.role, "pedidos");
  return { deletedAt: null, ...(scope === "own" ? { ownerId: session.user.id } : {}) };
}

export async function getOrderForSession(session: Session, companyId: string, id: string) {
  return prisma.salesOrder.findFirst({
    where: { id, ...orderScopeWhere(session, companyId) },
    include: {
      company: { select: { id: true, code: true, name: true, maxDiscountPct: true } },
      contact: true,
      seller: { select: { id: true, name: true } },
      approvedBy: { select: { name: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          product: {
            select: {
              id: true, sku: true, name: true, unit: true, kind: true, ncm: true, price: true, minPrice: true,
              weightKg: true,
              _count: { select: { components: true } },
            },
          },
        },
      },
      events: { orderBy: { createdAt: "desc" } },
      fiscalDocuments: { orderBy: { createdAt: "desc" } },
      receivables: { orderBy: { installment: "asc" } },
    },
  });
}

export async function addOrderEvent(
  tx: Tx | typeof prisma,
  orderId: string,
  actor: { id: string; name?: string | null } | null,
  type: string,
  message: string,
) {
  await tx.orderEvent.create({
    data: { orderId, userId: actor?.id ?? null, userName: actor?.name ?? (actor ? null : "Sistema"), type, message },
  });
}

export async function nextOrderNumber(tx: Tx, companyId: string) {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { nextOrderNumber: { increment: 1 } },
    select: { nextOrderNumber: true },
  });
  return company.nextOrderNumber - 1;
}

export type OrderItemInput = { productId: string; quantity: number; unitPrice: number; discountPct: number };

export type OrderInput = {
  contactId: string;
  sellerId?: string | null;
  channel?: SalesChannel;
  paymentMethod?: string | null;
  installments?: number;
  firstDueDays?: number;
  intervalDays?: number;
  discountTotal?: number;
  freight?: number;
  otherExpenses?: number;
  carrier?: string | null;
  shippingMode?: string | null;
  freightPayer?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  validUntil?: Date | null;
  items: OrderItemInput[];
};

/** Recalcula as linhas a partir dos produtos do banco (nunca confia em
 * subtotal vindo do navegador) e devolve o que gravar. */
async function buildItems(tx: Tx, companyId: string, items: OrderItemInput[]) {
  const clean = items.filter((i) => i.productId && i.quantity > 0);
  if (clean.length === 0) throw new OrderError("Inclua pelo menos um item.");
  const products = await tx.product.findMany({
    where: { companyId, id: { in: clean.map((i) => i.productId) }, deletedAt: null, active: true },
    select: { id: true, sku: true, price: true, minPrice: true, cost: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  let itemsTotal = D(0);
  const rows = clean.map((item, position) => {
    const product = byId.get(item.productId);
    if (!product) throw new OrderError("Produto inválido ou inativo nesta empresa.");
    if (!Number.isInteger(item.quantity)) throw new OrderError(`Quantidade de ${product.sku} deve ser inteira.`);
    const discountPct = Math.min(100, Math.max(0, item.discountPct || 0));
    const unitPrice = round2(item.unitPrice >= 0 ? item.unitPrice : 0);
    const subtotal = lineSubtotal(item.quantity, unitPrice, discountPct);
    itemsTotal = itemsTotal.add(subtotal);
    const effectiveUnit = subtotal.div(item.quantity);
    const belowMinPrice = product.minPrice !== null && effectiveUnit.lessThan(product.minPrice);
    return {
      productId: product.id,
      quantity: item.quantity,
      unitPrice,
      discountPct: D(discountPct),
      subtotal,
      unitCost: product.cost,
      belowMinPrice,
      position,
      listPrice: product.price,
      sku: product.sku,
    };
  });
  return { rows, itemsTotal };
}

/** Cria ou edita uma cotação. Só cotações (status COTACAO) são editáveis —
 * depois de enviada para aprovação o pedido fica congelado. */
export async function saveQuote(session: Session, companyId: string, input: OrderInput, orderId?: string) {
  if (!canEdit(session.user.role, "pedidos")) throw new OrderError("Sem permissão para editar pedidos.");

  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, ...orderContactScope(session) },
    select: { id: true, ownerId: true },
  });
  if (!contact) throw new OrderError("Cliente não encontrado na sua carteira.");

  const { scope } = getPermission(session.user.role, "pedidos");
  const sellerId = scope === "own" ? session.user.id : input.sellerId || contact.ownerId || session.user.id;
  if (sellerId !== session.user.id) {
    const seller = await prisma.user.findFirst({
      where: {
        id: sellerId,
        deletedAt: null,
        OR: [{ role: "MEDIATOR" }, { companies: { some: { companyId } } }],
      },
      select: { id: true },
    });
    if (!seller) throw new OrderError("Vendedor não opera esta empresa.");
  }

  return prisma.$transaction(async (tx) => {
    let existing: { id: string; status: SalesOrderStatus } | null = null;
    if (orderId) {
      existing = await tx.salesOrder.findFirst({
        where: { id: orderId, ...orderScopeWhere(session, companyId) },
        select: { id: true, status: true },
      });
      if (!existing) throw new OrderError("Pedido não encontrado.");
      if (existing.status !== "COTACAO") throw new OrderError("Só cotações podem ser editadas.");
    }

    const { rows, itemsTotal } = await buildItems(tx, companyId, input.items);
    const discountTotal = round2(Math.max(0, input.discountTotal ?? 0));
    const freight = round2(Math.max(0, input.freight ?? 0));
    const otherExpenses = round2(Math.max(0, input.otherExpenses ?? 0));
    const total = itemsTotal.add(freight).add(otherExpenses).sub(discountTotal);
    if (total.lessThan(0)) throw new OrderError("Desconto maior que o total do pedido.");

    const data = {
      contactId: contact.id,
      sellerId,
      paymentMethod: input.paymentMethod ?? null,
      installments: Math.min(24, Math.max(1, input.installments ?? 1)),
      firstDueDays: Math.max(0, input.firstDueDays ?? 30),
      intervalDays: Math.max(1, input.intervalDays ?? 30),
      itemsTotal,
      discountTotal,
      freight,
      otherExpenses,
      total,
      carrier: input.carrier ?? null,
      shippingMode: input.shippingMode ?? null,
      freightPayer: input.freightPayer ?? null,
      billingAddress: input.billingAddress ?? null,
      shippingAddress: input.shippingAddress ?? null,
      notes: input.notes ?? null,
      internalNotes: input.internalNotes ?? null,
      validUntil: input.validUntil ?? null,
      rejectionReason: null,
    };
    const itemRows = rows.map((r) => ({
      productId: r.productId, quantity: r.quantity, unitPrice: r.unitPrice, discountPct: r.discountPct,
      subtotal: r.subtotal, unitCost: r.unitCost, belowMinPrice: r.belowMinPrice, position: r.position,
    }));

    let order;
    if (existing) {
      await tx.salesOrderItem.deleteMany({ where: { orderId: existing.id } });
      order = await tx.salesOrder.update({
        where: { id: existing.id },
        data: { ...data, items: { create: itemRows } },
      });
      await addOrderEvent(tx, order.id, { id: session.user.id, name: session.user.name }, "updated", "Cotação atualizada.");
    } else {
      const number = await nextOrderNumber(tx, companyId);
      order = await tx.salesOrder.create({
        data: { ...data, companyId, number, channel: input.channel ?? "DIRETO", items: { create: itemRows } },
      });
      await addOrderEvent(tx, order.id, { id: session.user.id, name: session.user.name }, "created", "Cotação criada.");
    }

    // Auditoria de preço (§3): qualquer linha fora do preço de tabela.
    const priceChanges = rows
      .filter((r) => !r.unitPrice.equals(r.listPrice) || r.discountPct.greaterThan(0))
      .map((r) => ({ sku: r.sku, tabela: r.listPrice.toString(), praticado: r.unitPrice.toString(), descontoPct: r.discountPct.toString() }));
    if (priceChanges.length > 0) {
      await logActivity(
        { actorId: session.user.id, entityType: "SalesOrder", entityId: order.id, action: "price_changed", diff: priceChanges, companyId },
        tx,
      );
    }
    await logActivity(
      { actorId: session.user.id, entityType: "SalesOrder", entityId: order.id, action: existing ? "updated" : "created", companyId },
      tx,
    );
    return order;
  });
}

/** Regras de aprovação comercial (decisão em aberto §12 — padrão adotado:
 * aprovação só quando algo foge dos limites da empresa). */
export function approvalReasons(
  order: { itemsTotal: Prisma.Decimal; discountTotal: Prisma.Decimal; total: Prisma.Decimal },
  items: { belowMinPrice: boolean; discountPct: Prisma.Decimal; sku?: string }[],
  company: { maxDiscountPct: Prisma.Decimal; approvalAmountLimit: Prisma.Decimal | null },
) {
  const reasons: string[] = [];
  const below = items.filter((i) => i.belowMinPrice);
  if (below.length > 0) reasons.push(`${below.length} item(ns) abaixo do preço mínimo.`);
  const maxItemDisc = items.reduce((m, i) => (i.discountPct.greaterThan(m) ? i.discountPct : m), D(0));
  if (maxItemDisc.greaterThan(company.maxDiscountPct)) {
    reasons.push(`Desconto de item ${maxItemDisc.toString()}% acima do limite de ${company.maxDiscountPct.toString()}%.`);
  }
  if (order.itemsTotal.greaterThan(0)) {
    const orderDiscPct = order.discountTotal.div(order.itemsTotal).mul(100);
    if (orderDiscPct.greaterThan(company.maxDiscountPct)) {
      reasons.push(`Desconto no pedido de ${orderDiscPct.toFixed(1)}% acima do limite de ${company.maxDiscountPct.toString()}%.`);
    }
  }
  if (company.approvalAmountLimit && order.total.greaterThan(company.approvalAmountLimit)) {
    reasons.push(`Total acima do teto de aprovação automática.`);
  }
  return reasons;
}

/** Reserva o estoque de todas as linhas (kits explodidos em componentes).
 * Idempotente por linha/componente: reprocessar não reserva duas vezes. */
export async function reserveOrderStock(tx: Tx, orderId: string, userId: string | null) {
  const order = await tx.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, companyId: true, number: true, items: { select: { id: true, productId: true, quantity: true } } },
  });
  for (const item of order.items) {
    for (const part of await explodeKit(tx, item.productId, item.quantity)) {
      await applyMovement(tx, {
        companyId: order.companyId,
        productId: part.productId,
        type: "RESERVA",
        quantity: part.quantity,
        documentType: "SalesOrder",
        documentId: order.id,
        reason: `Reserva do pedido ${order.number}`,
        userId,
        idempotencyKey: `order:${order.id}:reserve:${item.id}:${part.productId}`,
      });
    }
  }
  await tx.salesOrder.update({ where: { id: order.id }, data: { stockReservedAt: new Date() } });
}

async function releaseOrderStock(tx: Tx, orderId: string, userId: string | null) {
  const order = await tx.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, companyId: true, number: true, items: { select: { id: true, productId: true, quantity: true } } },
  });
  for (const item of order.items) {
    for (const part of await explodeKit(tx, item.productId, item.quantity)) {
      // Só libera o que de fato foi reservado (pedido pode ter sido
      // cancelado antes da reserva).
      const reserved = await tx.stockMovement.findUnique({
        where: { idempotencyKey: `order:${order.id}:reserve:${item.id}:${part.productId}` },
      });
      if (!reserved) continue;
      await applyMovement(tx, {
        companyId: order.companyId,
        productId: part.productId,
        type: "LIBERACAO",
        quantity: reserved.quantity,
        documentType: "SalesOrder",
        documentId: order.id,
        reason: `Cancelamento do pedido ${order.number}`,
        userId,
        idempotencyKey: `order:${order.id}:release:${item.id}:${part.productId}`,
      });
    }
  }
}

async function loadForTransition(tx: Tx, session: Session, companyId: string, orderId: string) {
  const order = await tx.salesOrder.findFirst({
    where: { id: orderId, ...orderScopeWhere(session, companyId) },
    include: { items: { include: { product: { select: { sku: true } } } }, company: true },
  });
  if (!order) throw new OrderError("Pedido não encontrado.");
  return order;
}

function friendly(e: unknown): never {
  if (e instanceof StockError) throw new OrderError(e.message);
  throw e;
}

/** Envia a cotação: se estiver dentro dos limites, aprova e reserva na hora
 * (registrando que foi aprovação automática); senão vai para a fila de
 * aprovação da gerência. */
export async function submitOrder(session: Session, companyId: string, orderId: string) {
  if (!canEdit(session.user.role, "pedidos")) throw new OrderError("Sem permissão.");
  const actor = { id: session.user.id, name: session.user.name };
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await loadForTransition(tx, session, companyId, orderId);
      if (order.status !== "COTACAO") throw new OrderError("Só cotações podem ser enviadas.");
      if (order.items.length === 0) throw new OrderError("Pedido sem itens.");
      const reasons = approvalReasons(
        order,
        order.items.map((i) => ({ belowMinPrice: i.belowMinPrice, discountPct: i.discountPct, sku: i.product.sku })),
        order.company,
      );
      const now = new Date();
      if (reasons.length > 0) {
        await tx.salesOrder.update({
          where: { id: order.id },
          data: { status: "AGUARDANDO_APROVACAO", needsApproval: true, approvalReason: reasons.join(" "), submittedAt: now },
        });
        await addOrderEvent(tx, order.id, actor, "submitted", `Enviado para aprovação: ${reasons.join(" ")}`);
        await logActivity(
          { actorId: actor.id, entityType: "SalesOrder", entityId: order.id, action: "submitted", diff: { reasons }, companyId },
          tx,
        );
        return { status: "AGUARDANDO_APROVACAO" as const, reasons };
      }
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "APROVADO", needsApproval: false, approvalReason: "Dentro dos limites comerciais: aprovação automática.", submittedAt: now, approvedAt: now },
      });
      await reserveOrderStock(tx, order.id, actor.id);
      await addOrderEvent(tx, order.id, actor, "approved", "Aprovado automaticamente (dentro dos limites) e estoque reservado.");
      await logActivity(
        { actorId: actor.id, entityType: "SalesOrder", entityId: order.id, action: "approved", diff: { automatic: true }, companyId },
        tx,
      );
      return { status: "APROVADO" as const, reasons };
    });
  } catch (e) {
    friendly(e);
  }
}

export async function approveOrder(session: Session, companyId: string, orderId: string) {
  if (!canApproveOrders(session.user.role)) throw new OrderError("Apenas gerência/diretoria aprova pedidos.");
  const actor = { id: session.user.id, name: session.user.name };
  try {
    await prisma.$transaction(async (tx) => {
      const order = await loadForTransition(tx, session, companyId, orderId);
      if (order.status !== "AGUARDANDO_APROVACAO") throw new OrderError("Pedido não está aguardando aprovação.");
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "APROVADO", approvedById: actor.id, approvedAt: new Date() },
      });
      await reserveOrderStock(tx, order.id, actor.id);
      await addOrderEvent(tx, order.id, actor, "approved", "Aprovado e estoque reservado.");
      await logActivity({ actorId: actor.id, entityType: "SalesOrder", entityId: order.id, action: "approved", companyId }, tx);
    });
  } catch (e) {
    friendly(e);
  }
}

export async function rejectOrder(session: Session, companyId: string, orderId: string, reason: string) {
  if (!canApproveOrders(session.user.role)) throw new OrderError("Apenas gerência/diretoria reprova pedidos.");
  if (!reason.trim()) throw new OrderError("Informe o motivo.");
  const actor = { id: session.user.id, name: session.user.name };
  await prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, session, companyId, orderId);
    if (order.status !== "AGUARDANDO_APROVACAO") throw new OrderError("Pedido não está aguardando aprovação.");
    await tx.salesOrder.update({ where: { id: order.id }, data: { status: "COTACAO", rejectionReason: reason } });
    await addOrderEvent(tx, order.id, actor, "rejected", `Reprovado: ${reason}. Voltou para cotação.`);
    await logActivity(
      { actorId: actor.id, entityType: "SalesOrder", entityId: order.id, action: "rejected", diff: { reason }, companyId },
      tx,
    );
  });
}

/** Cancela antes do envio. Libera a reserva e cancela títulos em aberto;
 * com nota autorizada o Fiscal precisa cancelar a nota antes. */
export async function cancelOrder(session: Session, companyId: string, orderId: string, reason: string) {
  if (!canEdit(session.user.role, "pedidos")) throw new OrderError("Sem permissão.");
  if (!reason.trim()) throw new OrderError("Informe o motivo do cancelamento.");
  const actor = { id: session.user.id, name: session.user.name };
  try {
    await prisma.$transaction(async (tx) => {
      const order = await loadForTransition(tx, session, companyId, orderId);
      if (order.status === "CANCELADO") return;
      if (reachedStatus(order.status, "ENVIADO")) throw new OrderError("Pedido já enviado: registre uma devolução.");
      // Pedido já aprovado é compromisso comercial: vendedor não cancela sozinho.
      if (reachedStatus(order.status, "APROVADO") && !canApproveOrders(session.user.role)) {
        throw new OrderError("Pedido aprovado só pode ser cancelado pela gerência/diretoria.");
      }
      const activeDoc = await tx.fiscalDocument.findUnique({ where: { activeKey: order.id } });
      if (activeDoc && activeDoc.status !== "REJEITADA") {
        throw new OrderError("Existe nota fiscal ativa para este pedido. Cancele a nota no módulo Fiscal primeiro.");
      }
      if (activeDoc) {
        // Nota rejeitada nunca autorizada: só libera o vínculo.
        await tx.fiscalDocument.update({ where: { id: activeDoc.id }, data: { activeKey: null, status: "CANCELADA", cancelledAt: new Date(), cancelReason: "Pedido cancelado" } });
      }
      await releaseOrderStock(tx, order.id, actor.id);
      await cancelOpenReceivablesForOrder(tx, order.id);
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "CANCELADO", cancelledAt: new Date(), cancelReason: reason },
      });
      await addOrderEvent(tx, order.id, actor, "cancelled", `Cancelado: ${reason}`);
      await logActivity(
        { actorId: actor.id, entityType: "SalesOrder", entityId: order.id, action: "cancelled", diff: { reason }, companyId },
        tx,
      );
    });
  } catch (e) {
    friendly(e);
  }
}

// ---------------------------------------------------------------------------
// Expedição (§4.12): separação → conferência → embalagem → despacho → entrega.
// ---------------------------------------------------------------------------

export type ShippingStep = "start_picking" | "picked" | "checked" | "dispatch" | "delivered";

export type ShippingData = {
  packages?: number | null;
  grossWeightKg?: number | null;
  dimensions?: string | null;
  carrier?: string | null;
  shippingMode?: string | null;
  freightPayer?: string | null;
  trackingCode?: string | null;
};

const STEP_FROM: Record<ShippingStep, SalesOrderStatus> = {
  start_picking: "APROVADO",
  picked: "EM_SEPARACAO",
  checked: "EM_CONFERENCIA",
  dispatch: "PRONTO_EXPEDICAO",
  delivered: "ENVIADO",
};

export async function advanceShipping(
  session: Session,
  companyId: string,
  orderId: string,
  step: ShippingStep,
  data: ShippingData = {},
) {
  if (!canEdit(session.user.role, "expedicao")) throw new OrderError("Sem permissão para a expedição.");
  const actor = { id: session.user.id, name: session.user.name };
  try {
    await prisma.$transaction(async (tx) => {
      // Expedição enxerga todos os pedidos da empresa (não só os de um vendedor).
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, companyId },
        include: { items: true },
      });
      if (!order) throw new OrderError("Pedido não encontrado.");
      if (order.status !== STEP_FROM[step]) {
        throw new OrderError(`Etapa inválida: pedido está em "${ORDER_STATUS_LABELS[order.status]}".`);
      }
      const now = new Date();
      switch (step) {
        case "start_picking":
          await tx.salesOrder.update({ where: { id: order.id }, data: { status: "EM_SEPARACAO" } });
          await addOrderEvent(tx, order.id, actor, "picking", "Separação iniciada.");
          break;
        case "picked":
          await tx.salesOrder.update({
            where: { id: order.id },
            data: { status: "EM_CONFERENCIA", separatedById: actor.id, separatedAt: now },
          });
          await addOrderEvent(tx, order.id, actor, "picked", "Separação concluída; aguardando conferência.");
          break;
        case "checked": {
          if (order.separatedById === actor.id && session.user.role !== "MEDIATOR") {
            throw new OrderError("A conferência deve ser feita por outra pessoa que não separou o pedido.");
          }
          if (!data.packages || data.packages < 1) throw new OrderError("Informe a quantidade de volumes.");
          await tx.salesOrder.update({
            where: { id: order.id },
            data: {
              status: "PRONTO_EXPEDICAO",
              checkedById: actor.id,
              checkedAt: now,
              packages: data.packages,
              grossWeightKg: data.grossWeightKg ?? null,
              dimensions: data.dimensions ?? null,
            },
          });
          await addOrderEvent(tx, order.id, actor, "checked", `Conferido e embalado: ${data.packages} volume(s).`);
          break;
        }
        case "dispatch": {
          const doc = await tx.fiscalDocument.findUnique({ where: { activeKey: order.id } });
          if (!doc || doc.status !== "AUTORIZADA") {
            throw new OrderError("Despacho exige nota fiscal autorizada (§5: documento autorizado → expedição).");
          }
          if (!data.carrier) throw new OrderError("Informe a transportadora.");
          for (const item of order.items) {
            for (const part of await explodeKit(tx, item.productId, item.quantity)) {
              await applyMovement(tx, {
                companyId: order.companyId,
                productId: part.productId,
                type: "SAIDA",
                quantity: part.quantity,
                documentType: "SalesOrder",
                documentId: order.id,
                reason: `Expedição do pedido ${order.number}`,
                userId: actor.id,
                idempotencyKey: `order:${order.id}:ship:${item.id}:${part.productId}`,
              });
            }
          }
          await tx.salesOrder.update({
            where: { id: order.id },
            data: {
              status: "ENVIADO",
              shippedAt: now,
              shippedById: actor.id,
              carrier: data.carrier,
              shippingMode: data.shippingMode ?? order.shippingMode,
              freightPayer: data.freightPayer ?? order.freightPayer,
              trackingCode: data.trackingCode ?? null,
            },
          });
          await addOrderEvent(
            tx,
            order.id,
            actor,
            "dispatched",
            `Despachado via ${data.carrier}${data.trackingCode ? ` (rastreio ${data.trackingCode})` : ""}. Baixa de estoque registrada.`,
          );
          await logActivity({ actorId: actor.id, entityType: "SalesOrder", entityId: order.id, action: "dispatched", companyId }, tx);
          break;
        }
        case "delivered":
          await tx.salesOrder.update({ where: { id: order.id }, data: { status: "ENTREGUE", deliveredAt: now } });
          await addOrderEvent(tx, order.id, actor, "delivered", "Entrega confirmada.");
          await logActivity({ actorId: actor.id, entityType: "SalesOrder", entityId: order.id, action: "delivered", companyId }, tx);
          break;
      }
    });
  } catch (e) {
    friendly(e);
  }
}

export async function registerShippingIssue(session: Session, companyId: string, orderId: string, issue: string) {
  if (!canEdit(session.user.role, "expedicao")) throw new OrderError("Sem permissão para a expedição.");
  const order = await prisma.salesOrder.findFirst({ where: { id: orderId, companyId }, select: { id: true, shippingIssue: true } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await prisma.salesOrder.update({
    where: { id: order.id },
    data: { shippingIssue: `${order.shippingIssue ? `${order.shippingIssue}\n` : ""}[${stamp}] ${issue}` },
  });
  await addOrderEvent(prisma, order.id, { id: session.user.id, name: session.user.name }, "issue", `Ocorrência: ${issue}`);
}

/** Devolução após o envio: volta a mercadoria ao estoque (ou ao bloqueio,
 * se avariada). Chave por requisição evita lançar a mesma devolução duas
 * vezes num duplo clique. */
export async function registerReturn(
  session: Session,
  companyId: string,
  orderId: string,
  input: { productId: string; quantity: number; damaged: boolean; reason: string; requestKey: string },
) {
  if (!canEdit(session.user.role, "expedicao") && !canEdit(session.user.role, "estoque")) {
    throw new OrderError("Sem permissão para registrar devoluções.");
  }
  const actor = { id: session.user.id, name: session.user.name };
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id: orderId, companyId }, select: { id: true, number: true, status: true } });
      if (!order || !reachedStatus(order.status, "ENVIADO")) throw new OrderError("Devolução só para pedidos enviados.");
      const base = {
        companyId,
        productId: input.productId,
        quantity: input.quantity,
        documentType: "SalesOrder",
        documentId: order.id,
        reason: `Devolução do pedido ${order.number}: ${input.reason}`,
        userId: actor.id,
      };
      const { skipped } = await applyMovement(tx, { ...base, type: "DEVOLUCAO", idempotencyKey: `return:${input.requestKey}` });
      if (skipped) return;
      if (input.damaged) {
        await applyMovement(tx, { ...base, type: "BLOQUEIO", idempotencyKey: `return:${input.requestKey}:block` });
      }
      await addOrderEvent(tx, order.id, actor, "returned", `Devolução de ${input.quantity} un. ${input.damaged ? "(avariada, bloqueada)" : ""}: ${input.reason}`);
    });
  } catch (e) {
    friendly(e);
  }
}
