import "server-only";
import type { Session } from "next-auth";
import { Prisma, type PurchaseStatus, type Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { applyMovement, StockError } from "@/lib/erp/stock";
import { addDays, D, round2, splitInstallments } from "@/lib/erp/money";
import { computeLandedCosts, type CostAllocation } from "@/lib/erp/landed-cost";

export { computeLandedCosts, type CostAllocation } from "@/lib/erp/landed-cost";

export class PurchaseError extends Error {}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  SOLICITADO: "Solicitação",
  COTACAO: "Em cotação",
  APROVADO: "Aprovada",
  RECEBIDO_PARCIAL: "Recebida parcial",
  RECEBIDO: "Recebida",
  CANCELADO: "Cancelada",
};

export const ALLOCATION_LABELS: Record<CostAllocation, string> = {
  VALOR: "Proporcional ao valor",
  QUANTIDADE: "Proporcional à quantidade",
  PESO: "Proporcional ao peso",
};

/** Aprovação de compras: Diretoria e Mediador. Compras cria, não aprova. */
export function canApprovePurchases(role: Role): boolean {
  return role === "MANAGER" || role === "MEDIATOR";
}

/** Recebimento físico: Compras ou Estoque. */
export function canReceivePurchases(role: Role): boolean {
  return canEdit(role, "compras") || canEdit(role, "estoque");
}

export type PurchaseItemInput = { productId: string; quantity: number; unitCostForeign: number };

export type PurchaseInput = {
  supplierId: string;
  isImport: boolean;
  currency: string;
  exchangeRate: number;
  freight: number;
  insurance: number;
  customsExpenses: number;
  importTaxes: number;
  otherExpenses: number;
  costAllocation: CostAllocation;
  installments: number;
  firstDueDays: number;
  intervalDays: number;
  expectedAt: Date | null;
  quoteNotes: string | null;
  notes: string | null;
  items: PurchaseItemInput[];
};

const money = (v: number) => round2(Math.max(0, v || 0));

async function validateItems(tx: Prisma.TransactionClient, companyId: string, items: PurchaseItemInput[]) {
  const clean = items.filter((i) => i.productId && i.quantity > 0);
  if (clean.length === 0) throw new PurchaseError("Inclua pelo menos um item.");
  const products = await tx.product.findMany({
    where: { companyId, id: { in: clean.map((i) => i.productId) }, deletedAt: null },
    select: { id: true, sku: true, _count: { select: { components: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return clean.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw new PurchaseError("Produto inválido nesta empresa.");
    if (p._count.components > 0) throw new PurchaseError(`${p.sku} é um kit: compre os componentes.`);
    if (!Number.isInteger(i.quantity)) throw new PurchaseError(`Quantidade de ${p.sku} deve ser inteira.`);
    if (!(i.unitCostForeign >= 0)) throw new PurchaseError(`Custo de ${p.sku} inválido.`);
    return { productId: p.id, quantity: i.quantity, unitCostForeign: D(i.unitCostForeign).toDecimalPlaces(4) };
  });
}

function headerData(input: PurchaseInput) {
  const currency = (input.isImport ? input.currency : "BRL").toUpperCase().slice(0, 3) || "BRL";
  const rate = currency === "BRL" ? 1 : input.exchangeRate;
  if (!(rate > 0)) throw new PurchaseError("Informe a taxa de câmbio.");
  return {
    isImport: input.isImport,
    currency,
    exchangeRate: D(rate).toDecimalPlaces(6),
    freight: money(input.freight),
    insurance: money(input.insurance),
    customsExpenses: money(input.customsExpenses),
    importTaxes: money(input.importTaxes),
    otherExpenses: money(input.otherExpenses),
    costAllocation: input.costAllocation,
    installments: Math.min(24, Math.max(1, Math.trunc(input.installments || 1))),
    firstDueDays: Math.max(0, Math.trunc(input.firstDueDays || 0)),
    intervalDays: Math.max(1, Math.trunc(input.intervalDays || 30)),
    expectedAt: input.expectedAt,
    quoteNotes: input.quoteNotes,
    notes: input.notes,
  };
}

export async function savePurchase(session: Session, companyId: string, input: PurchaseInput, id?: string) {
  if (!canEdit(session.user.role, "compras")) throw new PurchaseError("Sem permissão em Compras.");
  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, companyId, deletedAt: null } });
  if (!supplier) throw new PurchaseError("Fornecedor inválido.");
  const header = headerData(input);

  return prisma.$transaction(async (tx) => {
    const items = await validateItems(tx, companyId, input.items);
    if (id) {
      const existing = await tx.purchaseOrder.findFirst({ where: { id, companyId } });
      if (!existing) throw new PurchaseError("Compra não encontrada.");
      if (existing.status !== "SOLICITADO" && existing.status !== "COTACAO") {
        throw new PurchaseError("Só solicitações e cotações podem ser editadas.");
      }
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: { ...header, supplierId: supplier.id, items: { create: items } },
      });
      await logActivity({ actorId: session.user.id, entityType: "PurchaseOrder", entityId: po.id, action: "updated", companyId }, tx);
      return po;
    }
    const company = await tx.company.update({
      where: { id: companyId },
      data: { nextPurchaseNumber: { increment: 1 } },
      select: { nextPurchaseNumber: true },
    });
    const po = await tx.purchaseOrder.create({
      data: {
        ...header,
        companyId,
        number: company.nextPurchaseNumber - 1,
        supplierId: supplier.id,
        requestedById: session.user.id,
        items: { create: items },
      },
    });
    await logActivity({ actorId: session.user.id, entityType: "PurchaseOrder", entityId: po.id, action: "created", companyId }, tx);
    return po;
  });
}

/** Total da compra em BRL: itens convertidos pelo câmbio + todas as despesas. */
export function purchaseTotal(po: {
  exchangeRate: Prisma.Decimal;
  freight: Prisma.Decimal;
  insurance: Prisma.Decimal;
  customsExpenses: Prisma.Decimal;
  importTaxes: Prisma.Decimal;
  otherExpenses: Prisma.Decimal;
  items: { quantity: number; unitCostForeign: Prisma.Decimal }[];
}) {
  const goods = po.items.reduce((s, i) => s.add(i.unitCostForeign.mul(i.quantity)), D(0)).mul(po.exchangeRate);
  const expenses = po.freight.add(po.insurance).add(po.customsExpenses).add(po.importTaxes).add(po.otherExpenses);
  return { goods: round2(goods), expenses, total: round2(goods.add(expenses)) };
}

export async function movePurchaseToQuote(session: Session, companyId: string, id: string) {
  if (!canEdit(session.user.role, "compras")) throw new PurchaseError("Sem permissão em Compras.");
  const res = await prisma.purchaseOrder.updateMany({ where: { id, companyId, status: "SOLICITADO" }, data: { status: "COTACAO" } });
  if (res.count !== 1) throw new PurchaseError("Só solicitações podem ir para cotação.");
  await logActivity({ actorId: session.user.id, entityType: "PurchaseOrder", entityId: id, action: "updated", diff: { status: "COTACAO" }, companyId });
}

/** Aprova e gera as contas a pagar (uma por parcela). A unique
 * (purchaseOrderId, installment) + skipDuplicates torna a geração
 * idempotente; o pagamento em si ainda passa pela aprovação no Financeiro. */
export async function approvePurchase(session: Session, companyId: string, id: string) {
  if (!canApprovePurchases(session.user.role)) throw new PurchaseError("Apenas a diretoria aprova compras.");
  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({ where: { id, companyId }, include: { items: true, supplier: true } });
    if (!po) throw new PurchaseError("Compra não encontrada.");
    if (po.status !== "SOLICITADO" && po.status !== "COTACAO") throw new PurchaseError("Compra não está pendente de aprovação.");
    if (po.items.length === 0) throw new PurchaseError("Compra sem itens.");
    const now = new Date();
    const upd = await tx.purchaseOrder.updateMany({
      where: { id: po.id, status: { in: ["SOLICITADO", "COTACAO"] } },
      data: { status: "APROVADO", approvedById: session.user.id, approvedAt: now },
    });
    if (upd.count !== 1) throw new PurchaseError("Compra já foi aprovada.");
    const { total } = purchaseTotal(po);
    const parts = splitInstallments(total, po.installments);
    await tx.payable.createMany({
      skipDuplicates: true,
      data: parts.map((amount, i) => ({
        companyId,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        installment: i + 1,
        description: `Compra ${po.number} - ${po.supplier.name} - parcela ${i + 1}/${parts.length}`,
        category: po.isImport ? "Importação" : "Fornecedores",
        amount,
        dueDate: addDays(now, po.firstDueDays + i * po.intervalDays),
        createdById: session.user.id,
      })),
    });
    await logActivity({ actorId: session.user.id, entityType: "PurchaseOrder", entityId: po.id, action: "approved", companyId }, tx);
  });
}

export async function cancelPurchase(session: Session, companyId: string, id: string, reason: string) {
  if (!canEdit(session.user.role, "compras") && !canApprovePurchases(session.user.role)) {
    throw new PurchaseError("Sem permissão em Compras.");
  }
  if (!reason.trim()) throw new PurchaseError("Informe o motivo.");
  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({ where: { id, companyId }, include: { receipts: { select: { id: true } } } });
    if (!po) throw new PurchaseError("Compra não encontrada.");
    if (po.status === "CANCELADO") return;
    if (po.receipts.length > 0 || po.status === "RECEBIDO_PARCIAL" || po.status === "RECEBIDO") {
      throw new PurchaseError("Compra com recebimento não pode ser cancelada.");
    }
    const paid = await tx.payable.count({ where: { purchaseOrderId: po.id, paidAmount: { gt: 0 } } });
    if (paid > 0) throw new PurchaseError("Há contas a pagar com pagamento registrado para esta compra.");
    await tx.payable.updateMany({
      where: { purchaseOrderId: po.id, status: { in: ["ABERTO", "PARCIAL"] } },
      data: { status: "CANCELADO", cancelledAt: new Date() },
    });
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "CANCELADO", cancelledAt: new Date(), notes: `${po.notes ? `${po.notes}\n` : ""}Cancelada: ${reason}` },
    });
    await logActivity({ actorId: session.user.id, entityType: "PurchaseOrder", entityId: po.id, action: "cancelled", diff: { reason }, companyId }, tx);
  });
}

export type ReceiptInput = {
  requestKey: string;
  invoiceNumber: string | null;
  notes: string | null;
  quantities: Record<string, number>;
};

/** Recebimento (total ou parcial): entrada de estoque, custo de entrada
 * (landed) e custo médio ponderado do produto, tudo numa transação. A
 * requestKey do formulário é única no PurchaseReceipt e compõe as chaves
 * de idempotência dos movimentos — reenviar o mesmo formulário não dá
 * entrada duas vezes. */
export async function receivePurchase(session: Session, companyId: string, id: string, input: ReceiptInput) {
  if (!canReceivePurchases(session.user.role)) throw new PurchaseError("Sem permissão para receber compras.");
  if (!input.requestKey) throw new PurchaseError("Requisição inválida.");
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.purchaseReceipt.findUnique({ where: { requestKey: input.requestKey } })) return;
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE`;
      const po = await tx.purchaseOrder.findFirst({
        where: { id, companyId },
        include: { items: { include: { product: { select: { id: true, sku: true, weightKg: true } } } } },
      });
      if (!po) throw new PurchaseError("Compra não encontrada.");
      if (po.status !== "APROVADO" && po.status !== "RECEBIDO_PARCIAL") throw new PurchaseError("Compra não está aguardando recebimento.");

      const landed = computeLandedCosts(po);
      const received: { itemId: string; sku: string; quantity: number; landedUnitCost: string }[] = [];

      for (const item of po.items) {
        const q = Math.trunc(input.quantities[item.id] ?? 0);
        if (q <= 0) continue;
        if (q > item.quantity - item.receivedQty) {
          throw new PurchaseError(`${item.product.sku}: quantidade acima do saldo a receber (${item.quantity - item.receivedQty}).`);
        }
        const upd = await tx.purchaseOrderItem.updateMany({
          where: { id: item.id, receivedQty: { lte: item.quantity - q } },
          data: { receivedQty: { increment: q } },
        });
        if (upd.count !== 1) throw new PurchaseError(`${item.product.sku}: recebimento excede o pedido.`);

        const landedUnit = landed.byItem.get(item.id)?.landedUnitCost ?? D(0);
        const before = await tx.product.findUniqueOrThrow({ where: { id: item.productId }, select: { stockPhysical: true, cost: true } });
        await applyMovement(tx, {
          companyId,
          productId: item.productId,
          type: "ENTRADA",
          quantity: q,
          documentType: "PurchaseOrder",
          documentId: po.id,
          reason: `Recebimento da compra ${po.number}${input.invoiceNumber ? ` (NF ${input.invoiceNumber})` : ""}`,
          userId: session.user.id,
          idempotencyKey: `receipt:${input.requestKey}:${item.id}`,
        });
        const oldQty = Math.max(0, before.stockPhysical);
        const newCost = oldQty + q > 0 ? before.cost.mul(oldQty).add(landedUnit.mul(q)).div(oldQty + q) : landedUnit;
        await tx.product.update({ where: { id: item.productId }, data: { cost: newCost.toDecimalPlaces(4) } });
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { landedUnitCost: landedUnit } });
        await tx.productSupplier.upsert({
          where: { productId_supplierId: { productId: item.productId, supplierId: po.supplierId } },
          update: { lastCost: landedUnit },
          create: { productId: item.productId, supplierId: po.supplierId, lastCost: landedUnit },
        });
        received.push({ itemId: item.id, sku: item.product.sku, quantity: q, landedUnitCost: landedUnit.toString() });
      }
      if (received.length === 0) throw new PurchaseError("Informe a quantidade recebida de pelo menos um item.");

      await tx.purchaseReceipt.create({
        data: {
          purchaseOrderId: po.id,
          requestKey: input.requestKey,
          invoiceNumber: input.invoiceNumber,
          notes: input.notes,
          items: received,
          userId: session.user.id,
        },
      });
      const after = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id }, select: { quantity: true, receivedQty: true } });
      const complete = after.every((i) => i.receivedQty >= i.quantity);
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "RECEBIDO" : "RECEBIDO_PARCIAL" } });
      await logActivity(
        { actorId: session.user.id, entityType: "PurchaseOrder", entityId: po.id, action: "received", diff: received, companyId },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof StockError) throw new PurchaseError(e.message);
    throw e;
  }
}
