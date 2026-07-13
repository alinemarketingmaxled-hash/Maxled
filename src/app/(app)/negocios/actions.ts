"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEdit } from "@/lib/permissions";
import {
  createDeal,
  moveDeal,
  addDealNote,
  softDeleteDeal,
  createStage,
  renameStage,
  deleteStage,
} from "@/lib/deals";

async function requireEdit() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit(session.user.role, "negocios")) {
    throw new Error("Sem permissão para editar Negócios.");
  }
  return session;
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

export async function moveDealAction(dealId: string, newStageId: string) {
  const session = await requireEdit();
  await moveDeal(session, dealId, newStageId);
  revalidatePath("/negocios");
  revalidatePath("/agenda");
}

export async function addDealNoteAction(dealId: string, formData: FormData) {
  const session = await requireEdit();
  const body = (formData.get("body") as string)?.trim();
  if (!body) return;
  await addDealNote(session, dealId, body);
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
