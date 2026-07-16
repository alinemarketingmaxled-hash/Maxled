"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEdit, canView } from "@/lib/permissions";
import {
  createDeal,
  moveDeal,
  addDealNote,
  softDeleteDeal,
  createStage,
  renameStage,
  deleteStage,
  addPastSale,
  getDeal,
  toggleDealNoteFlag,
} from "@/lib/deals";

async function requireEdit() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit(session.user.role, "negocios")) {
    throw new Error("Sem permissão para editar Negócios.");
  }
  return session;
}

export type DealDetail = {
  id: string;
  name: string;
  value: number;
  stageName: string;
  ownerName: string | null;
  contactId: string;
  contactName: string;
  accountName: string | null;
  onTheWayDeadline: string | null;
  notes: {
    id: string;
    body: string | null;
    createdAt: string;
    flagged: boolean;
    attachmentUrl: string | null;
  }[];
  activityLogs: {
    id: string;
    action: string;
    actorName: string | null;
    createdAt: string;
  }[];
};

/** Backs the deal-detail modal opened by clicking a card on the Kanban
 * board — returns null instead of redirecting so the modal can show a
 * friendly "not found" state rather than navigating the whole page away. */
export async function getDealDetailAction(dealId: string): Promise<DealDetail | null> {
  const session = await auth();
  if (!session?.user || !canView(session.user.role, "negocios")) return null;

  const deal = await getDeal(session, dealId);
  if (!deal) return null;

  return {
    id: deal.id,
    name: deal.name,
    value: Number(deal.value),
    stageName: deal.stage.name,
    ownerName: deal.owner.name,
    contactId: deal.contactId,
    contactName: `${deal.contact.firstName} ${deal.contact.lastName}`,
    accountName: deal.contact.accountName,
    onTheWayDeadline: deal.onTheWayDeadline ? deal.onTheWayDeadline.toISOString() : null,
    notes: deal.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      flagged: n.flagged,
      attachmentUrl: n.attachmentUrl,
    })),
    activityLogs: deal.activityLogs.map((l) => ({
      id: l.id,
      action: l.action,
      actorName: l.actor.name,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export async function createDealAction(formData: FormData) {
  const session = await requireEdit();
  const contactId = formData.get("contactId") as string;
  const stageId = formData.get("stageId") as string;
  const name = (formData.get("name") as string)?.trim();
  const value = Number(formData.get("value"));
  const ownerId = (formData.get("ownerId") as string) || session.user.id;

  if (!contactId || !stageId || !name || Number.isNaN(value)) {
    throw new Error("Preencha contato, nome e valor do negócio.");
  }

  await createDeal(session, { ownerId, contactId, stageId, name, value });
  revalidatePath("/negocios");
  redirect("/negocios");
}

/** Backs the "Registrar venda antiga" form on a client's Histórico tab —
 * onboarding an existing customer whose real sales history predates the
 * CRM. Returns {error} instead of throwing so the form can show it inline. */
export async function addPastSaleAction(
  contactId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  const name = (formData.get("name") as string)?.trim();
  const value = Number(formData.get("value"));
  const soldAtStr = (formData.get("soldAt") as string)?.trim();
  const ownerId = (formData.get("ownerId") as string) || session.user.id;

  if (!name || Number.isNaN(value) || value <= 0 || !soldAtStr) {
    return { error: "Preencha nome, valor e a data da venda." };
  }
  const soldAt = new Date(soldAtStr);
  if (Number.isNaN(soldAt.getTime())) return { error: "Data inválida." };
  if (soldAt > new Date()) return { error: "A data da venda não pode ser no futuro." };

  try {
    await addPastSale(session, { ownerId, contactId, name, value, soldAt });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao registrar a venda antiga." };
  }
  revalidatePath("/vendas");
  return { ok: true };
}

export async function moveDealAction(dealId: string, newStageId: string) {
  const session = await requireEdit();
  await moveDeal(session, dealId, newStageId);
  revalidatePath("/negocios");
  revalidatePath("/agenda");
}

export async function addDealNoteAction(
  dealId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  const body = (formData.get("body") as string)?.trim() || null;
  const attachmentUrl = (formData.get("attachmentUrl") as string)?.trim() || null;
  if (!body && !attachmentUrl) return { error: "Escreva algo ou anexe uma foto/print." };

  try {
    await addDealNote(session, dealId, body, attachmentUrl);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar a nota." };
  }
  revalidatePath("/negocios");
  return { ok: true };
}

export async function toggleDealNoteFlagAction(noteId: string) {
  const session = await requireEdit();
  await toggleDealNoteFlag(session, noteId);
  revalidatePath("/negocios");
}

export async function deleteDealAction(dealId: string) {
  const session = await requireEdit();
  await softDeleteDeal(session, dealId);
  revalidatePath("/negocios");
}

export async function createStageAction(pipelineId: string, formData: FormData) {
  await requireEdit();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  await createStage(pipelineId, name);
  revalidatePath("/negocios");
}

export async function renameStageAction(stageId: string, name: string) {
  await requireEdit();
  if (!name.trim()) return;
  await renameStage(stageId, name.trim());
  revalidatePath("/negocios");
}

export async function deleteStageAction(stageId: string) {
  await requireEdit();
  await deleteStage(stageId);
  revalidatePath("/negocios");
}
