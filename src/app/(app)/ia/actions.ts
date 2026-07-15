"use server";

import { requireView } from "@/lib/require-permission";
import { isAiConfigured, getSalesInsights, getDealAssist, type DealAssistMode } from "@/lib/ai";
import { sendDealWhatsApp } from "@/lib/deals";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado ao falar com a IA.";
}

export async function generateInsightsAction() {
  const session = await requireView("ia");
  if (!isAiConfigured()) {
    return { error: "IA ainda não configurada. Peça para o administrador cadastrar a ANTHROPIC_API_KEY." };
  }
  try {
    return { data: await getSalesInsights(session) };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function generateDealAssistAction(
  dealId: string,
  mode: DealAssistMode,
  context: string,
) {
  const session = await requireView("ia");
  if (!isAiConfigured()) {
    return { error: "IA ainda não configurada. Peça para o administrador cadastrar a ANTHROPIC_API_KEY." };
  }
  if (!dealId) return { error: "Escolha um negócio." };
  try {
    return { data: await getDealAssist(session, dealId, mode, context) };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function sendDealWhatsAppAction(dealId: string, message: string) {
  const session = await requireView("ia");
  try {
    await sendDealWhatsApp(session, dealId, message);
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
