"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireView } from "@/lib/require-permission";
import { logCallOutcome } from "@/lib/calls";
import { search, type SearchResult } from "@/lib/search";

export async function logCallOutcomeAction(contactId: string, outcome: string) {
  const session = await requireView("analitica");
  if (!outcome.trim()) throw new Error("Descreva o que houve na ligação.");
  await logCallOutcome(session, contactId, outcome.trim());
  revalidatePath("/");
}

export async function searchAction(query: string): Promise<SearchResult> {
  const session = await auth();
  if (!session?.user) return { contacts: [], deals: [] };
  return search(session, query);
}
