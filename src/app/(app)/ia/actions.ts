"use server";

import { requireView } from "@/lib/require-permission";
import { getSalesInsights, getDealAssist, type DealAssistMode } from "@/lib/ai";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado ao gerar a análise.";
}

export async function generateInsightsAction() {
  const session = await requireView("ia");
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
  if (!dealId) return { error: "Escolha um negócio." };
  try {
    return { data: await getDealAssist(session, dealId, mode, context) };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
