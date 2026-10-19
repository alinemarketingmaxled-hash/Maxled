import "server-only";
import type { Session } from "next-auth";
import { Prisma, type IntegrationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { fetchMlOrder, ML_PROVIDER, processMlOrder, type MlOrder } from "@/lib/erp/mercadolivre";

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  PENDENTE: "Pendente",
  PROCESSADO: "Processado",
  ERRO: "Erro",
  IGNORADO: "Ignorado",
};

/** Operações conhecidas por provedor. */
export const ML_OPERATIONS = {
  /** Notificação real do ML (busca o pedido na API). */
  webhookOrder: "orders_v2",
  /** Pedido sintético da tela de homologação (payload já é o pedido). */
  simulatedOrder: "order_simulated",
} as const;

export const MAX_AUTO_ATTEMPTS = 5;

/** Registra um evento de integração. A chave de idempotência é única: o
 * mesmo evento recebido duas vezes devolve o registro existente. */
export async function recordEvent(input: {
  companyId: string | null;
  provider: string;
  operation: string;
  externalId?: string | null;
  idempotencyKey: string;
  payload?: Prisma.InputJsonValue;
  status?: IntegrationStatus;
  lastError?: string | null;
}) {
  const existing = await prisma.integrationEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { event: existing, created: false };
  try {
    const event = await prisma.integrationEvent.create({
      data: {
        companyId: input.companyId,
        provider: input.provider,
        operation: input.operation,
        externalId: input.externalId ?? null,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        status: input.status ?? "PENDENTE",
        lastError: input.lastError ?? null,
      },
    });
    return { event, created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const event = await prisma.integrationEvent.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
      return { event, created: false };
    }
    throw e;
  }
}

function orderIdFromResource(resource: unknown) {
  const m = typeof resource === "string" ? resource.match(/\/orders\/(\d+)/) : null;
  return m?.[1] ?? null;
}

async function dispatch(event: { companyId: string | null; provider: string; operation: string; payload: Prisma.JsonValue }) {
  if (event.provider !== ML_PROVIDER) {
    return { status: "IGNORADO" as const, message: `Provedor ${event.provider} sem processador.` };
  }
  if (!event.companyId) return { status: "IGNORADO" as const, message: "Conta ML não vinculada a nenhuma empresa." };
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  let mlOrder: MlOrder;
  if (event.operation === ML_OPERATIONS.simulatedOrder) {
    mlOrder = payload.order as MlOrder;
  } else if (event.operation === ML_OPERATIONS.webhookOrder || event.operation === "orders") {
    const orderId = orderIdFromResource(payload.resource);
    if (!orderId) return { status: "IGNORADO" as const, message: "Recurso sem id de pedido." };
    mlOrder = await fetchMlOrder(event.companyId, orderId);
  } else {
    return { status: "IGNORADO" as const, message: `Tópico ${event.operation} não tratado.` };
  }
  const result = await processMlOrder(event.companyId, mlOrder);
  return {
    status: result.outcome === "ignored" ? ("IGNORADO" as const) : ("PROCESSADO" as const),
    message: result.message,
    resultRef: result.orderId ?? null,
  };
}

/** Processa um evento. Sucesso → PROCESSADO (ou IGNORADO), falha → ERRO com
 * a mensagem, sempre contando a tentativa. Seguro chamar de novo: os
 * efeitos (pedido, reserva) são idempotentes. */
export async function processEvent(id: string) {
  const event = await prisma.integrationEvent.findUnique({ where: { id } });
  if (!event) throw new Error("Evento não encontrado.");
  if (event.status === "PROCESSADO" || event.status === "IGNORADO") return event;
  try {
    const r = await dispatch(event);
    return prisma.integrationEvent.update({
      where: { id },
      data: {
        status: r.status,
        attempts: { increment: 1 },
        lastError: r.status === "IGNORADO" ? r.message : null,
        resultRef: "resultRef" in r ? r.resultRef : null,
        processedAt: new Date(),
      },
    });
  } catch (e) {
    return prisma.integrationEvent.update({
      where: { id },
      data: { status: "ERRO", attempts: { increment: 1 }, lastError: e instanceof Error ? e.message : "Falha desconhecida." },
    });
  }
}

export async function reprocessEvent(session: Session, companyId: string, id: string) {
  if (!canEdit(session.user.role, "mercadolivre")) throw new Error("Sem permissão para reprocessar integrações.");
  const event = await prisma.integrationEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new Error("Evento não encontrado.");
  if (event.status !== "ERRO" && event.status !== "PENDENTE") throw new Error("Só eventos com erro ou pendentes podem ser reprocessados.");
  const updated = await processEvent(event.id);
  await logActivity({
    actorId: session.user.id,
    entityType: "Integration",
    entityId: event.id,
    action: "reprocessed",
    diff: { status: updated.status },
    companyId,
  });
  return updated;
}

/** Usado pelo cron: reprocessa erros/pendências com menos de 5 tentativas. */
export async function retryPendingEvents(limit = 50) {
  const events = await prisma.integrationEvent.findMany({
    where: { status: { in: ["ERRO", "PENDENTE"] }, attempts: { lt: MAX_AUTO_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results: { id: string; status: IntegrationStatus }[] = [];
  for (const e of events) {
    const r = await processEvent(e.id);
    results.push({ id: r.id, status: r.status });
  }
  return results;
}
