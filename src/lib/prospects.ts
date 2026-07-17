import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission, type Module } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { createContact } from "@/lib/contacts";
import type { Prisma, ProspectTemperature } from "@/generated/prisma/client";

function prospectScopeWhere(session: Session, mod: Module = "prospeccoes"): Prisma.ProspectWhereInput {
  const { scope } = getPermission(session.user.role, mod);
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

export async function listProspectStages() {
  return prisma.prospectStage.findMany({ orderBy: { order: "asc" } });
}

/** The spreadsheet-style board: every active (not yet converted) prospect the
 * user can see, with every stage cell it has ever filled in and its pending
 * client-activation request, if any. */
export async function listProspects(session: Session) {
  return prisma.prospect.findMany({
    where: { deletedAt: null, convertedAt: null, ...prospectScopeWhere(session) },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { name: true } },
      currentStage: true,
      stageValues: true,
      activationRequest: true,
    },
  });
}

export type ProspectInput = {
  ownerId: string;
  name: string;
  clientName: string;
  phone?: string | null;
  email?: string | null;
  temperature: ProspectTemperature;
  profile: string;
  notes?: string | null;
  contactDate: Date;
};

export async function createProspect(session: Session, data: ProspectInput) {
  const firstStage = await prisma.prospectStage.findFirst({ orderBy: { order: "asc" } });
  if (!firstStage) throw new Error("Nenhuma coluna de prospecção configurada.");

  const prospect = await prisma.prospect.create({
    data: { ...data, currentStageId: firstStage.id },
  });
  await logActivity({
    actorId: session.user.id,
    entityType: "Prospect",
    entityId: prospect.id,
    action: "created",
  });
  return prospect;
}

export type ProspectUpdateInput = {
  name: string;
  clientName: string;
  phone?: string | null;
  email?: string | null;
  temperature: ProspectTemperature;
  profile: string;
  notes?: string | null;
  contactDate: Date;
  ownerId: string;
};

export async function updateProspect(session: Session, prospectId: string, data: ProspectUpdateInput) {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, deletedAt: null, ...prospectScopeWhere(session) },
  });
  if (!prospect) throw new Error("Prospecção não encontrada ou sem permissão.");

  const updated = await prisma.prospect.update({ where: { id: prospectId }, data });
  await logActivity({
    actorId: session.user.id,
    entityType: "Prospect",
    entityId: prospectId,
    action: "updated",
  });
  return updated;
}

export async function deleteProspect(session: Session, prospectId: string) {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, deletedAt: null, ...prospectScopeWhere(session) },
  });
  if (!prospect) throw new Error("Prospecção não encontrada ou sem permissão.");

  await prisma.prospect.update({ where: { id: prospectId }, data: { deletedAt: new Date() } });
  await logActivity({
    actorId: session.user.id,
    entityType: "Prospect",
    entityId: prospectId,
    action: "deleted",
  });
}

/** The board's columns unlock left-to-right: a stage can only be filled
 * once the previous one (by order) is marked done for that prospect. */
async function assertStageUnlocked(prospectId: string, stage: { order: number }) {
  if (stage.order === 0) return;
  const prevStage = await prisma.prospectStage.findFirst({ where: { order: stage.order - 1 } });
  if (!prevStage) return;
  const prevValue = await prisma.prospectStageValue.findUnique({
    where: { prospectId_stageId: { prospectId, stageId: prevStage.id } },
  });
  if (!prevValue?.done) {
    throw new Error(`Conclua a etapa "${prevStage.name}" antes de preencher esta.`);
  }
}

export type StageValueInput = { date: Date | null; note: string | null; done: boolean };

/** Fills/edits one cell of the sheet. Also bumps lastTouchedAt (resets the
 * "atraso" clock) and, if this column is at or past the prospect's current
 * one, moves it forward — filling a later column always counts as progress. */
export async function upsertProspectStageValue(
  session: Session,
  prospectId: string,
  stageId: string,
  data: StageValueInput,
) {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, deletedAt: null, ...prospectScopeWhere(session) },
    include: { currentStage: true },
  });
  if (!prospect) throw new Error("Prospecção não encontrada ou sem permissão.");
  const stage = await prisma.prospectStage.findUniqueOrThrow({ where: { id: stageId } });
  await assertStageUnlocked(prospectId, stage);

  const value = await prisma.prospectStageValue.upsert({
    where: { prospectId_stageId: { prospectId, stageId } },
    update: { date: data.date, note: data.note, done: data.done },
    create: { prospectId, stageId, date: data.date, note: data.note, done: data.done },
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      lastTouchedAt: new Date(),
      ...(stage.order >= prospect.currentStage.order ? { currentStageId: stageId } : {}),
    },
  });

  return value;
}

export type ActivationInput = {
  razaoSocial: string;
  cnpj: string;
  emailFinanceiro: string;
  emailNfe: string;
  inscricaoEstadual: string;
  enderecoFaturamento: string;
  enderecoEntrega: string;
  valor: number;
  condicaoPagamento: string;
};

/** Seller/manager submits the sintegra-style form to request turning a
 * prospect into an active client. Upserts so a rejected request can be
 * corrected and resubmitted without losing its place. */
export async function submitActivationRequest(session: Session, prospectId: string, data: ActivationInput) {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, deletedAt: null, ...prospectScopeWhere(session) },
  });
  if (!prospect) throw new Error("Prospecção não encontrada ou sem permissão.");

  const clientStage = await prisma.prospectStage.findFirst({ where: { isClientStage: true } });
  if (!clientStage) throw new Error('Coluna "Cliente Ativo" não configurada.');
  await assertStageUnlocked(prospectId, clientStage);

  const request = await prisma.clientActivationRequest.upsert({
    where: { prospectId },
    update: { ...data, status: "PENDENTE", reviewerId: null, rejectionReason: null, decidedAt: null },
    create: { prospectId, ...data },
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { lastTouchedAt: new Date(), currentStageId: clientStage.id },
  });

  await logActivity({
    actorId: session.user.id,
    entityType: "Prospect",
    entityId: prospectId,
    action: "updated",
    diff: { note: "Enviado para aprovação como cliente ativo" } as Prisma.InputJsonValue,
  });

  return request;
}

/** Mediator-only queue: every activation request awaiting a decision. */
export async function listPendingActivationRequests(session: Session) {
  if (session.user.role !== "MEDIATOR") return [];
  return prisma.clientActivationRequest.findMany({
    where: { status: "PENDENTE" },
    orderBy: { createdAt: "asc" },
    include: { prospect: { include: { owner: { select: { name: true } } } } },
  });
}

/**
 * Approving converts the prospect into a real Contact, opens a Deal
 * (negociação) for it in the default pipeline, and carries the prospect's
 * stage-by-stage history into the deal's notes timeline — everything except
 * the mediator-approval step itself, per spec.
 */
export async function approveActivation(session: Session, requestId: string) {
  if (session.user.role !== "MEDIATOR") throw new Error("Apenas o mediador pode aprovar clientes.");

  const request = await prisma.clientActivationRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      prospect: { include: { stageValues: { include: { stage: true }, orderBy: { updatedAt: "asc" } } } },
    },
  });
  if (request.status !== "PENDENTE") throw new Error("Essa solicitação já foi decidida.");

  const prospect = request.prospect;
  const [firstName, ...rest] = prospect.name.trim().split(/\s+/);

  const contact = await createContact(session, {
    ownerId: prospect.ownerId,
    firstName: firstName || prospect.name,
    lastName: rest.join(" ") || "-",
    accountName: request.razaoSocial,
    cnpj: request.cnpj,
    email: prospect.email,
    phone: prospect.phone,
    street: request.enderecoFaturamento,
    inscricaoEstadual: request.inscricaoEstadual,
    emailFinanceiro: request.emailFinanceiro,
    emailNfe: request.emailNfe,
    enderecoEntrega: request.enderecoEntrega,
    crmStatus: "ATIVO",
  });

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { pipeline: { isDefault: true } },
    orderBy: { order: "asc" },
  });
  if (!firstStage) throw new Error("Nenhum pipeline de negócios configurado.");

  const deal = await prisma.deal.create({
    data: {
      ownerId: prospect.ownerId,
      contactId: contact.id,
      stageId: firstStage.id,
      name: `${prospect.clientName} — Negociação`,
      value: request.valor,
      paymentMethod: request.condicaoPagamento,
    },
  });

  for (const v of prospect.stageValues) {
    if (!v.note && !v.date) continue;
    await prisma.dealNote.create({
      data: {
        dealId: deal.id,
        authorId: prospect.ownerId,
        body: `${v.stage.name}${v.date ? ` (${v.date.toLocaleDateString("pt-BR")})` : ""}: ${v.note ?? ""}`.trim(),
        createdAt: v.date ?? v.updatedAt,
      },
    });
  }

  await prisma.clientActivationRequest.update({
    where: { id: requestId },
    data: { status: "APROVADO", reviewerId: session.user.id, decidedAt: new Date() },
  });
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { convertedContactId: contact.id, convertedAt: new Date() },
  });

  await logActivity({
    actorId: session.user.id,
    entityType: "Deal",
    entityId: deal.id,
    action: "created",
    dealId: deal.id,
    contactId: contact.id,
    diff: { note: "Cliente aprovado a partir de uma prospecção" } as Prisma.InputJsonValue,
  });

  return { contact, deal };
}

export async function rejectActivation(session: Session, requestId: string, reason: string) {
  if (session.user.role !== "MEDIATOR") throw new Error("Apenas o mediador pode recusar clientes.");
  if (!reason.trim()) throw new Error("Explique o motivo da recusa para o vendedor.");

  const request = await prisma.clientActivationRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status !== "PENDENTE") throw new Error("Essa solicitação já foi decidida.");

  return prisma.clientActivationRequest.update({
    where: { id: requestId },
    data: {
      status: "RECUSADO",
      reviewerId: session.user.id,
      rejectionReason: reason.trim(),
      decidedAt: new Date(),
    },
  });
}
