import "server-only";
import { Prisma, type StockMovementType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export class StockError extends Error {}

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  RESERVA: "Reserva",
  LIBERACAO: "Liberação de reserva",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (-)",
  DEVOLUCAO: "Devolução",
  BLOQUEIO: "Bloqueio/avaria",
  DESBLOQUEIO: "Desbloqueio",
  TRANSFERENCIA_SAIDA: "Transferência (saída)",
  TRANSFERENCIA_ENTRADA: "Transferência (entrada)",
};

export type MovementInput = {
  companyId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string | null;
  documentType?: string | null;
  documentId?: string | null;
  lot?: string | null;
  serial?: string | null;
  userId?: string | null;
  /** Mesma chave = mesmo efeito. Reenviar/reprocessar uma operação com a
   * mesma chave não movimenta de novo (é assim que kits e integrações
   * nunca dão baixa dupla). */
  idempotencyKey?: string | null;
};

/**
 * Aplica um movimento e atualiza os saldos do produto na mesma transação.
 * Cada decremento é um UPDATE condicional (o saldo é conferido pelo próprio
 * banco, não por uma leitura anterior), então duas reservas concorrentes
 * nunca deixam o disponível negativo.
 *
 * Retorna `skipped: true` quando a chave de idempotência já foi aplicada.
 */
export async function applyMovement(tx: Tx, input: MovementInput) {
  const q = Math.floor(input.quantity);
  if (!Number.isFinite(q) || q <= 0) throw new StockError("Quantidade deve ser maior que zero.");

  if (input.idempotencyKey) {
    const existing = await tx.stockMovement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { movement: existing, skipped: true as const };
  }

  const product = await tx.product.findFirst({
    where: { id: input.productId, companyId: input.companyId, deletedAt: null },
    select: { id: true, sku: true, name: true, _count: { select: { components: true } } },
  });
  if (!product) throw new StockError("Produto não encontrado nesta empresa.");
  if (product._count.components > 0) {
    throw new StockError(`${product.sku} é um kit: movimente os componentes (use explodeKit).`);
  }

  const id = product.id;
  let updated = 0;
  switch (input.type) {
    case "ENTRADA":
    case "DEVOLUCAO":
    case "AJUSTE_POSITIVO":
    case "TRANSFERENCIA_ENTRADA":
      updated = await tx.$executeRaw`UPDATE "Product" SET "stockPhysical" = "stockPhysical" + ${q} WHERE id = ${id}`;
      break;
    case "AJUSTE_NEGATIVO":
    case "TRANSFERENCIA_SAIDA":
      updated = await tx.$executeRaw`UPDATE "Product" SET "stockPhysical" = "stockPhysical" - ${q}
        WHERE id = ${id} AND "stockPhysical" - "stockReserved" - "stockBlocked" >= ${q}`;
      break;
    case "RESERVA":
      updated = await tx.$executeRaw`UPDATE "Product" SET "stockReserved" = "stockReserved" + ${q}
        WHERE id = ${id} AND "stockPhysical" - "stockReserved" - "stockBlocked" >= ${q}`;
      break;
    case "LIBERACAO":
      updated = await tx.$executeRaw`UPDATE "Product" SET "stockReserved" = "stockReserved" - ${q}
        WHERE id = ${id} AND "stockReserved" >= ${q}`;
      break;
    case "SAIDA":
      // Saída sempre consome uma reserva prévia (pedido aprovado → expedição).
      updated = await tx.$executeRaw`UPDATE "Product" SET "stockPhysical" = "stockPhysical" - ${q},
        "stockReserved" = "stockReserved" - ${q}
        WHERE id = ${id} AND "stockReserved" >= ${q} AND "stockPhysical" >= ${q}`;
      break;
    case "BLOQUEIO":
      updated = await tx.$executeRaw`UPDATE "Product" SET "stockBlocked" = "stockBlocked" + ${q}
        WHERE id = ${id} AND "stockPhysical" - "stockReserved" - "stockBlocked" >= ${q}`;
      break;
    case "DESBLOQUEIO":
      updated = await tx.$executeRaw`UPDATE "Product" SET "stockBlocked" = "stockBlocked" - ${q}
        WHERE id = ${id} AND "stockBlocked" >= ${q}`;
      break;
  }
  if (updated !== 1) {
    throw new StockError(`Saldo insuficiente de ${product.sku} (${product.name}) para ${MOVEMENT_LABELS[input.type].toLowerCase()} de ${q}.`);
  }

  const after = await tx.product.findUniqueOrThrow({
    where: { id },
    select: { stockPhysical: true, stockReserved: true, stockBlocked: true },
  });

  const movement = await tx.stockMovement.create({
    data: {
      companyId: input.companyId,
      productId: id,
      type: input.type,
      quantity: q,
      physicalAfter: after.stockPhysical,
      reservedAfter: after.stockReserved,
      blockedAfter: after.stockBlocked,
      reason: input.reason ?? null,
      documentType: input.documentType ?? null,
      documentId: input.documentId ?? null,
      lot: input.lot ?? null,
      serial: input.serial ?? null,
      userId: input.userId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
  return { movement, skipped: false as const };
}

/** Troca um item vendido pelas peças que ele realmente movimenta: um kit de
 * 25 LEDs vira 25 × o SKU do LED; um produto simples vira ele mesmo. */
export async function explodeKit(tx: Tx | typeof prisma, productId: string, quantity: number) {
  const components = await tx.kitComponent.findMany({ where: { kitId: productId } });
  if (components.length === 0) return [{ productId, quantity }];
  return components.map((c) => ({ productId: c.componentId, quantity: c.quantity * quantity }));
}

export function available(p: { stockPhysical: number; stockReserved: number; stockBlocked: number }) {
  return p.stockPhysical - p.stockReserved - p.stockBlocked;
}

/** Disponibilidade de vários produtos de uma vez; kits = quantos kits
 * completos os componentes permitem montar. */
export async function availabilityFor(companyId: string, productIds: string[]) {
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: productIds } },
    select: {
      id: true,
      stockPhysical: true,
      stockReserved: true,
      stockBlocked: true,
      components: {
        select: {
          quantity: true,
          component: { select: { stockPhysical: true, stockReserved: true, stockBlocked: true } },
        },
      },
    },
  });
  const map = new Map<string, number>();
  for (const p of products) {
    if (p.components.length === 0) {
      map.set(p.id, available(p));
    } else {
      map.set(
        p.id,
        Math.max(0, Math.min(...p.components.map((c) => Math.floor(available(c.component) / c.quantity)))),
      );
    }
  }
  return map;
}
