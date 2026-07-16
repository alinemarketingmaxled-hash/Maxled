import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission, type Module } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { addBusinessDays } from "@/lib/business-days";
import type { Prisma } from "@/generated/prisma/client";

/** See the note in lib/contacts.ts — "team" and "all" both see every deal until a team/hierarchy model exists. */
function dealScopeWhere(session: Session, mod: Module = "negocios"): Prisma.DealWhereInput {
  const { scope } = getPermission(session.user.role, mod);
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

export async function listOnTheWayDeals(session: Session) {
  return prisma.deal.findMany({
    where: {
      deletedAt: null,
      stage: { isOnTheWay: true },
      ...dealScopeWhere(session, "agenda"),
    },
    orderBy: { onTheWayDeadline: "asc" },
    include: {
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      owner: { select: { name: true } },
      stage: { select: { name: true, autoAdvanceToStage: { select: { name: true } } } },
    },
  });
}

/** Open (not-yet-won) deals for the home page's "negociações em andamento"
 * panel — scoped like the rest of Analítica (own/team/all), not "negocios",
 * since that's the page it lives on. */
export async function getInProgressDeals(session: Session, limit = 8) {
  return prisma.deal.findMany({
    where: { deletedAt: null, stage: { isWon: false }, ...dealScopeWhere(session, "analitica") },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      owner: { select: { name: true } },
      stage: { select: { name: true } },
    },
  });
}

export async function getBoard(session: Session) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          deals: {
            where: { deletedAt: null, ...dealScopeWhere(session) },
            orderBy: { createdAt: "desc" },
            include: {
              contact: {
                select: {
                  firstName: true,
                  lastName: true,
                  accountName: true,
                  phone: true,
                  mobile: true,
                  email: true,
                },
              },
              owner: { select: { name: true } },
              notes: true,
            },
          },
        },
      },
    },
  });
  return pipeline;
}

export async function getDeal(session: Session, id: string) {
  return prisma.deal.findFirst({
    where: { id, deletedAt: null, ...dealScopeWhere(session) },
    include: {
      contact: true,
      owner: { select: { name: true } },
      stage: { select: { name: true } },
      notes: { orderBy: { createdAt: "desc" } },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });
}

export type DealInput = {
  ownerId: string;
  contactId: string;
  stageId: string;
  name: string;
  value: number;
};

export async function createDeal(session: Session, data: DealInput) {
  const deal = await prisma.deal.create({ data });
  await logActivity({
    actorId: session.user.id,
    entityType: "Deal",
    entityId: deal.id,
    action: "created",
    dealId: deal.id,
    contactId: data.contactId,
  });
  return deal;
}

export type PastSaleInput = {
  ownerId: string;
  contactId: string;
  name: string;
  value: number;
  soldAt: Date;
};

/**
 * Backfills a sale that happened before the client existed in the CRM —
 * e.g. onboarding an existing customer's portfolio. Lands the deal directly
 * in the pipeline's "won" stage, dated soldAt (both createdAt/updatedAt),
 * so it shows up in that month's history and revenue instead of today's —
 * spec request: "ficará apenas nos meses anteriores que a pessoa colocar".
 */
export async function addPastSale(session: Session, data: PastSaleInput) {
  const wonStage = await prisma.pipelineStage.findFirst({
    where: { pipeline: { isDefault: true }, isWon: true },
    orderBy: { order: "asc" },
  });
  if (!wonStage) throw new Error('Nenhuma etapa "ganho" configurada no pipeline.');

  const deal = await prisma.deal.create({
    data: {
      ownerId: data.ownerId,
      contactId: data.contactId,
      stageId: wonStage.id,
      name: data.name,
      value: data.value,
      createdAt: data.soldAt,
      updatedAt: data.soldAt,
    },
  });
  await logActivity({
    actorId: session.user.id,
    entityType: "Deal",
    entityId: deal.id,
    action: "created",
    dealId: deal.id,
    contactId: data.contactId,
    diff: { note: "Venda antiga registrada manualmente." } as Prisma.InputJsonValue,
  });
  return deal;
}

/**
 * Moves a deal to a new stage. Implements the Agenda automation from
 * docs/CRM-SPEC.md §3.4: entering the "A caminho" stage starts a 3-business-
 * day countdown and fires the post-sale message; leaving it manually before
 * the deadline cancels the countdown (manual action always wins).
 */
export async function moveDeal(session: Session, dealId: string, newStageId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...dealScopeWhere(session) },
  });
  if (!deal) throw new Error("Negócio não encontrado ou sem permissão.");

  const newStage = await prisma.pipelineStage.findUniqueOrThrow({ where: { id: newStageId } });

  const data: Prisma.DealUpdateInput = { stage: { connect: { id: newStageId } } };

  if (newStage.isOnTheWay) {
    const now = new Date();
    data.onTheWaySince = now;
    data.onTheWayDeadline = addBusinessDays(now, 3);
    data.postSaleSentAt = now;
  } else {
    data.onTheWaySince = null;
    data.onTheWayDeadline = null;
  }

  const updated = await prisma.deal.update({ where: { id: dealId }, data });

  await logActivity({
    actorId: session.user.id,
    entityType: "Deal",
    entityId: dealId,
    action: "stage_changed",
    dealId,
    diff: { from: deal.stageId, to: newStageId } as Prisma.InputJsonValue,
  });

  if (newStage.isOnTheWay) {
    await logActivity({
      actorId: session.user.id,
      entityType: "Deal",
      entityId: dealId,
      action: "updated",
      dealId,
      diff: {
        note: "Lembrete: envie a mensagem de pós-venda pelo WhatsApp (abra a conversa pelo ícone 📱 na ficha do cliente).",
        deadline: data.onTheWayDeadline,
      } as Prisma.InputJsonValue,
    });
  }

  return updated;
}

export async function addDealNote(session: Session, dealId: string, body: string, attachmentUrl?: string) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, ...dealScopeWhere(session) } });
  if (!deal) throw new Error("Negócio não encontrado ou sem permissão.");

  const note = await prisma.dealNote.create({
    data: { dealId, authorId: session.user.id, body, attachmentUrl },
  });
  await logActivity({
    actorId: session.user.id,
    entityType: "Deal",
    entityId: dealId,
    action: "updated",
    dealId,
    diff: { note: "Histórico do cliente atualizado" } as Prisma.InputJsonValue,
  });
  return note;
}

/** Toggles the "marked" state of a note in a deal's history — lets sellers
 * flag the message that matters (e.g. a client's key requirement) so it
 * stands out among the rest of the negotiation's notes. */
export async function toggleDealNoteFlag(session: Session, noteId: string) {
  const note = await prisma.dealNote.findFirst({
    where: { id: noteId, deal: dealScopeWhere(session) },
  });
  if (!note) throw new Error("Nota não encontrada ou sem permissão.");

  return prisma.dealNote.update({
    where: { id: noteId },
    data: { flagged: !note.flagged },
  });
}

export async function softDeleteDeal(session: Session, dealId: string) {
  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { deletedAt: new Date() },
  });
  await logActivity({
    actorId: session.user.id,
    entityType: "Deal",
    entityId: dealId,
    action: "deleted",
    dealId,
  });
  return deal;
}

export async function createStage(pipelineId: string, name: string) {
  const last = await prisma.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { order: "desc" },
  });
  return prisma.pipelineStage.create({
    data: { pipelineId, name, order: (last?.order ?? -1) + 1 },
  });
}

export async function renameStage(stageId: string, name: string) {
  return prisma.pipelineStage.update({ where: { id: stageId }, data: { name } });
}

/**
 * Deletes a column. Cards in it are never silently orphaned (spec §3.3): they're
 * reassigned to the first remaining stage in pipeline order before the delete.
 */
export async function deleteStage(stageId: string) {
  const stage = await prisma.pipelineStage.findUniqueOrThrow({ where: { id: stageId } });

  const fallback = await prisma.pipelineStage.findFirst({
    where: { pipelineId: stage.pipelineId, id: { not: stageId } },
    orderBy: { order: "asc" },
  });
  if (!fallback) throw new Error("Não é possível excluir a última coluna do quadro.");

  await prisma.$transaction([
    prisma.deal.updateMany({ where: { stageId }, data: { stageId: fallback.id } }),
    prisma.pipelineStage.updateMany({
      where: { autoAdvanceToStageId: stageId },
      data: { autoAdvanceToStageId: null },
    }),
    prisma.pipelineStage.delete({ where: { id: stageId } }),
  ]);

  return fallback;
}

/**
 * The scheduled half of the Agenda automation: advances any deal whose
 * "A caminho" deadline has passed. Meant to run on a daily cron (see
 * src/app/api/cron/advance-deals/route.ts) — system-scoped, not user-scoped.
 */
export async function checkAndAdvanceOverdueDeals() {
  const overdue = await prisma.deal.findMany({
    where: {
      deletedAt: null,
      onTheWayDeadline: { lte: new Date() },
      stage: { isOnTheWay: true, autoAdvanceToStageId: { not: null } },
    },
    include: { stage: true },
  });

  for (const deal of overdue) {
    if (!deal.stage.autoAdvanceToStageId) continue;
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        stageId: deal.stage.autoAdvanceToStageId,
        onTheWaySince: null,
        onTheWayDeadline: null,
      },
    });
    await logActivity({
      actorId: deal.ownerId,
      entityType: "Deal",
      entityId: deal.id,
      action: "stage_changed",
      dealId: deal.id,
      diff: {
        from: deal.stageId,
        to: deal.stage.autoAdvanceToStageId,
        note: "Avanço automático após prazo de 3 dias úteis",
      } as Prisma.InputJsonValue,
    });
  }

  return overdue.length;
}
