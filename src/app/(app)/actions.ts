"use server";

import { revalidatePath } from "next/cache";
import { requireView } from "@/lib/require-permission";
import { logCallOutcome } from "@/lib/calls";

export async function logCallOutcomeAction(contactId: string, outcome: string) {
  const session = await requireView("analitica");
  if (!outcome.trim()) throw new Error("Descreva o que houve na ligação.");
  await logCallOutcome(session, contactId, outcome.trim());
  revalidatePath("/");
}
