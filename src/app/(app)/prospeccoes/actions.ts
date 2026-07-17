"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEdit } from "@/lib/permissions";
import {
  createProspect,
  updateProspect,
  deleteProspect,
  upsertProspectStageValue,
  submitActivationRequest,
  approveActivation,
  rejectActivation,
  addCustomProspectStage,
  renameCustomProspectStage,
  deleteCustomProspectStage,
} from "@/lib/prospects";
import { createTask } from "@/lib/tasks";
import type { ProspectTemperature } from "@/generated/prisma/client";

async function requireEdit() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit(session.user.role, "prospeccoes")) {
    throw new Error("Sem permissão para editar Prospecções.");
  }
  return session;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado.";
}

const TEMPERATURES: ProspectTemperature[] = ["QUENTE", "MORNO", "FRIO"];

export async function createProspectAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  const name = (formData.get("name") as string)?.trim();
  const clientName = (formData.get("clientName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const temperature = (formData.get("temperature") as string)?.trim() as ProspectTemperature;
  const profile = (formData.get("profile") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  const contactDateStr = (formData.get("contactDate") as string)?.trim();

  if (!name || !clientName || !profile || !TEMPERATURES.includes(temperature) || !contactDateStr) {
    return { error: "Preencha nome, cliente, status, perfil e data." };
  }
  const contactDate = new Date(contactDateStr);
  if (Number.isNaN(contactDate.getTime())) return { error: "Data inválida." };

  try {
    await createProspect(session, {
      ownerId: session.user.id,
      name,
      clientName,
      phone,
      email,
      temperature,
      profile,
      notes,
      contactDate,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function updateProspectAction(
  prospectId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  const name = (formData.get("name") as string)?.trim();
  const clientName = (formData.get("clientName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const temperature = (formData.get("temperature") as string)?.trim() as ProspectTemperature;
  const profile = (formData.get("profile") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  const contactDateStr = (formData.get("contactDate") as string)?.trim();
  const ownerId = (formData.get("ownerId") as string)?.trim() || session.user.id;

  if (!name || !clientName || !profile || !TEMPERATURES.includes(temperature) || !contactDateStr) {
    return { error: "Preencha nome, cliente, status, perfil e data." };
  }
  const contactDate = new Date(contactDateStr);
  if (Number.isNaN(contactDate.getTime())) return { error: "Data inválida." };

  try {
    await updateProspect(session, prospectId, {
      name,
      clientName,
      phone,
      email,
      temperature,
      profile,
      notes,
      contactDate,
      ownerId,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProspectAction(prospectId: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  try {
    await deleteProspect(session, prospectId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function saveStageValueAction(
  prospectId: string,
  stageId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  const dateStr = (formData.get("date") as string)?.trim();
  const note = (formData.get("note") as string)?.trim() || null;
  const done = formData.get("done") === "on";
  const date = dateStr ? new Date(dateStr) : null;
  if (dateStr && Number.isNaN(date?.getTime())) return { error: "Data inválida." };

  try {
    await upsertProspectStageValue(session, prospectId, stageId, { date, note, done });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function submitActivationAction(
  prospectId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  const razaoSocial = (formData.get("razaoSocial") as string)?.trim();
  const cnpj = (formData.get("cnpj") as string)?.trim();
  const emailFinanceiro = (formData.get("emailFinanceiro") as string)?.trim();
  const emailNfe = (formData.get("emailNfe") as string)?.trim();
  const inscricaoEstadual = (formData.get("inscricaoEstadual") as string)?.trim();
  const enderecoFaturamento = (formData.get("enderecoFaturamento") as string)?.trim();
  const enderecoEntrega = (formData.get("enderecoEntrega") as string)?.trim();
  const valor = Number(formData.get("valor"));
  const condicaoPagamento = (formData.get("condicaoPagamento") as string)?.trim();

  if (
    !razaoSocial ||
    !cnpj ||
    !emailFinanceiro ||
    !emailNfe ||
    !inscricaoEstadual ||
    !enderecoFaturamento ||
    !enderecoEntrega ||
    !condicaoPagamento ||
    Number.isNaN(valor) ||
    valor <= 0
  ) {
    return { error: "Preencha todos os dados do cliente (mesmos campos do Sintegra) e um valor válido." };
  }

  try {
    await submitActivationRequest(session, prospectId, {
      razaoSocial,
      cnpj,
      emailFinanceiro,
      emailNfe,
      inscricaoEstadual,
      enderecoFaturamento,
      enderecoEntrega,
      valor,
      condicaoPagamento,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function approveActivationAction(requestId: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  try {
    await approveActivation(session, requestId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  revalidatePath("/negocios");
  revalidatePath("/vendas");
  return { ok: true };
}

export async function rejectActivationAction(
  requestId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const reason = (formData.get("reason") as string)?.trim();
  try {
    await rejectActivation(session, requestId, reason);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

/** Backs the "+ Agendar" button on the Prospecções board — a task with a
 * due date, optionally linked to an existing prospect. Shows up
 * automatically in "Tarefas de hoje"/"Atrasados" like any other task. */
export async function scheduleTaskAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireEdit();
  const title = (formData.get("title") as string)?.trim();
  const dueDateStr = (formData.get("dueDate") as string)?.trim();
  const linkValue = (formData.get("link") as string)?.trim() || "";
  const [linkType, linkId] = linkValue.split(":");
  const prospectId = linkType === "prospect" ? linkId : null;
  const dealId = linkType === "deal" ? linkId : null;

  if (!title || !dueDateStr) return { error: "Escreva o que fazer e escolha uma data." };
  const dueDate = new Date(dueDateStr);
  if (Number.isNaN(dueDate.getTime())) return { error: "Data inválida." };

  try {
    await createTask(session, title, dueDate, dealId, prospectId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  revalidatePath("/agenda");
  return { ok: true };
}

/** The 6 fixed columns can't be added/renamed/removed — only extra columns
 * appended after them, which any editor of Prospecções can manage. */
export async function addProspectStageAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireEdit();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Escreva um nome pra coluna." };
  try {
    await addCustomProspectStage(name);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function renameProspectStageAction(
  stageId: string,
  name: string,
): Promise<{ error?: string; ok?: boolean }> {
  await requireEdit();
  if (!name.trim()) return { error: "Escreva um nome pra coluna." };
  try {
    await renameCustomProspectStage(stageId, name.trim());
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProspectStageAction(stageId: string): Promise<{ error?: string; ok?: boolean }> {
  await requireEdit();
  try {
    await deleteCustomProspectStage(stageId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/");
  return { ok: true };
}
