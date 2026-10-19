import "server-only";
import type { Session } from "next-auth";
import type { StockMovementType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { applyMovement, StockError } from "@/lib/erp/stock";
import { userHasCompany } from "@/lib/erp/company";

/** Tipos que podem ser lançados à mão. Reserva/liberação/saída só pelos
 * pedidos; transferência só pela tela própria. */
export const MANUAL_TYPES: StockMovementType[] = [
  "ENTRADA",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "BLOQUEIO",
  "DESBLOQUEIO",
  "DEVOLUCAO",
];

function requireStockEdit(session: Session) {
  if (!canEdit(session.user.role, "estoque")) throw new StockError("Sem permissão para movimentar estoque.");
}

export async function manualMovement(
  session: Session,
  companyId: string,
  input: {
    productId: string;
    type: StockMovementType;
    quantity: number;
    reason: string;
    lot: string | null;
    serial: string | null;
    documentRef: string | null;
    requestKey: string;
  },
) {
  requireStockEdit(session);
  if (!MANUAL_TYPES.includes(input.type)) throw new StockError("Tipo de movimento não permitido aqui.");
  if (!input.reason.trim()) throw new StockError("Informe o motivo.");
  if (!input.requestKey) throw new StockError("Requisição inválida.");
  return prisma.$transaction(async (tx) => {
    const { movement, skipped } = await applyMovement(tx, {
      companyId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason.trim(),
      documentType: input.documentRef ? "Manual" : null,
      documentId: input.documentRef,
      lot: input.lot,
      serial: input.serial,
      userId: session.user.id,
      idempotencyKey: `manual:${input.requestKey}`,
    });
    if (!skipped) {
      await logActivity(
        {
          actorId: session.user.id,
          entityType: "StockMovement",
          entityId: movement.id,
          action: "stock_adjusted",
          diff: { type: input.type, quantity: movement.quantity, reason: input.reason, productId: input.productId },
          companyId,
        },
        tx,
      );
    }
    return { movement, skipped };
  });
}

/** Inventário: aplica a diferença entre contado e físico de cada produto.
 * A chave por produto deriva da requestKey da tela de confirmação, então
 * reenviar a mesma contagem não ajusta de novo. */
export async function applyInventoryCount(
  session: Session,
  companyId: string,
  counts: { productId: string; counted: number }[],
  requestKey: string,
) {
  requireStockEdit(session);
  if (!requestKey) throw new StockError("Requisição inválida.");
  let adjusted = 0;
  await prisma.$transaction(async (tx) => {
    for (const c of counts) {
      if (!Number.isInteger(c.counted) || c.counted < 0) throw new StockError("Quantidades contadas devem ser inteiros não negativos.");
      const p = await tx.product.findFirst({
        where: { id: c.productId, companyId, deletedAt: null },
        select: { id: true, sku: true, stockPhysical: true, _count: { select: { components: true } } },
      });
      if (!p || p._count.components > 0) continue;
      const diff = c.counted - p.stockPhysical;
      if (diff === 0) continue;
      const { movement, skipped } = await applyMovement(tx, {
        companyId,
        productId: p.id,
        type: diff > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
        quantity: Math.abs(diff),
        reason: `Inventário: contado ${c.counted}, sistema ${p.stockPhysical}`,
        documentType: "Inventario",
        documentId: requestKey,
        userId: session.user.id,
        idempotencyKey: `inventory:${requestKey}:${p.id}`,
      });
      if (skipped) continue;
      adjusted++;
      await logActivity(
        {
          actorId: session.user.id,
          entityType: "StockMovement",
          entityId: movement.id,
          action: "stock_adjusted",
          diff: { inventario: true, sku: p.sku, contado: c.counted, sistema: p.stockPhysical },
          companyId,
        },
        tx,
      );
    }
  }, { timeout: 60_000 });
  return adjusted;
}

export type TransferItem = { sku: string; quantity: number };

/** Transferência entre empresas (§2): sai da origem e entra no SKU igual
 * do destino, numa transação só, com registro do responsável. */
export async function transferBetweenCompanies(
  session: Session,
  fromCompanyId: string,
  input: { toCompanyId: string; items: TransferItem[]; documentRef: string | null; notes: string | null; requestKey: string },
) {
  requireStockEdit(session);
  if (!input.requestKey) throw new StockError("Requisição inválida.");
  if (input.toCompanyId === fromCompanyId) throw new StockError("Escolha uma empresa de destino diferente.");
  if (!(await userHasCompany(session, input.toCompanyId))) {
    throw new StockError("Você não tem acesso à empresa de destino.");
  }
  const merged = new Map<string, number>();
  for (const i of input.items) {
    const sku = i.sku.trim().toUpperCase();
    if (!sku) continue;
    if (!Number.isInteger(i.quantity) || i.quantity <= 0) throw new StockError(`Quantidade inválida para ${sku}.`);
    merged.set(sku, (merged.get(sku) ?? 0) + i.quantity);
  }
  if (merged.size === 0) throw new StockError("Inclua pelo menos um item.");

  return prisma.$transaction(async (tx) => {
    const done = await tx.stockTransfer.findUnique({ where: { requestKey: input.requestKey } });
    if (done) return done;
    const skus = [...merged.keys()];
    const [origin, dest] = await Promise.all([
      tx.product.findMany({ where: { companyId: fromCompanyId, sku: { in: skus }, deletedAt: null }, select: { id: true, sku: true } }),
      tx.product.findMany({ where: { companyId: input.toCompanyId, sku: { in: skus }, deletedAt: null }, select: { id: true, sku: true } }),
    ]);
    const items: { sku: string; quantity: number; fromProductId: string; toProductId: string }[] = [];
    for (const [sku, quantity] of merged) {
      const from = origin.find((p) => p.sku === sku);
      const to = dest.find((p) => p.sku === sku);
      if (!from) throw new StockError(`SKU ${sku} não existe nesta empresa.`);
      if (!to) throw new StockError(`SKU ${sku} não cadastrado na empresa de destino. Cadastre-o lá antes.`);
      items.push({ sku, quantity, fromProductId: from.id, toProductId: to.id });
    }
    const transfer = await tx.stockTransfer.create({
      data: {
        fromCompanyId,
        toCompanyId: input.toCompanyId,
        userId: session.user.id,
        documentRef: input.documentRef,
        notes: input.notes,
        requestKey: input.requestKey,
        items,
      },
    });
    for (const it of items) {
      await applyMovement(tx, {
        companyId: fromCompanyId,
        productId: it.fromProductId,
        type: "TRANSFERENCIA_SAIDA",
        quantity: it.quantity,
        reason: "Transferência entre empresas",
        documentType: "StockTransfer",
        documentId: transfer.id,
        userId: session.user.id,
        idempotencyKey: `transfer:${input.requestKey}:${it.fromProductId}:out`,
      });
      await applyMovement(tx, {
        companyId: input.toCompanyId,
        productId: it.toProductId,
        type: "TRANSFERENCIA_ENTRADA",
        quantity: it.quantity,
        reason: "Transferência entre empresas",
        documentType: "StockTransfer",
        documentId: transfer.id,
        userId: session.user.id,
        idempotencyKey: `transfer:${input.requestKey}:${it.toProductId}:in`,
      });
    }
    await logActivity(
      { actorId: session.user.id, entityType: "StockTransfer", entityId: transfer.id, action: "created", diff: { items }, companyId: fromCompanyId },
      tx,
    );
    return transfer;
  });
}

