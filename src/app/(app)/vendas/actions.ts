"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { canView, canEdit, getPermission } from "@/lib/permissions";
import {
  createContact,
  updateContact,
  softDeleteContact,
  listContacts,
  sendContactWhatsApp,
  type ContactInput,
} from "@/lib/contacts";
import { prisma } from "@/lib/prisma";
import { parseCsv, type ImportSummary } from "@/lib/csv";

function readContactInput(formData: FormData, ownerId: string): ContactInput {
  const str = (key: string) => (formData.get(key) as string)?.trim() || null;
  const lat = str("latitude");
  const lng = str("longitude");

  return {
    ownerId,
    firstName: (formData.get("firstName") as string)?.trim() ?? "",
    lastName: (formData.get("lastName") as string)?.trim() ?? "",
    accountName: str("accountName"),
    email: str("email"),
    phone: str("phone"),
    mobile: str("mobile"),
    residentialPhone: str("residentialPhone"),
    assistantPhone: str("assistantPhone"),
    leadSource: str("leadSource"),
    supplierName: str("supplierName"),
    jobTitle: str("jobTitle"),
    department: str("department"),
    street: str("street"),
    number: str("number"),
    city: str("city"),
    state: str("state"),
    postalCode: str("postalCode"),
    latitude: lat ? Number(lat) : null,
    longitude: lng ? Number(lng) : null,
  };
}

async function requireEdit() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit(session.user.role, "vendas")) {
    throw new Error("Sem permissão para editar Vendas.");
  }
  return session;
}

export async function createContactAction(formData: FormData) {
  const session = await requireEdit();
  const ownerId = (formData.get("ownerId") as string) || session.user.id;
  const input = readContactInput(formData, ownerId);
  if (!input.firstName || !input.lastName) {
    throw new Error("Nome e sobrenome são obrigatórios.");
  }
  const contact = await createContact(session, input);
  revalidatePath("/vendas");
  redirect(`/vendas?id=${contact.id}`);
}

export async function updateContactAction(id: string, formData: FormData) {
  const session = await requireEdit();
  const ownerId = (formData.get("ownerId") as string) || session.user.id;
  const input = readContactInput(formData, ownerId);
  await updateContact(session, id, input);
  revalidatePath("/vendas");
  redirect(`/vendas?id=${id}`);
}

export async function deleteContactAction(id: string) {
  const session = await requireEdit();
  await softDeleteContact(session, id);
  revalidatePath("/vendas");
  redirect("/vendas");
}

/**
 * Round-trips the CSV produced by /vendas/export: matches existing contacts
 * by e-mail (spec's "duplicate detection on import" recommendation) so a
 * re-import updates rather than duplicates, and resolves ownerEmail back to
 * a real owner, falling back to the importing user when no match is found.
 */
export async function importContactsAction(formData: FormData) {
  const session = await requireEdit();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Selecione um arquivo CSV.");

  const text = await file.text();
  const rows = parseCsv(text);

  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  const existing = await listContacts(session);
  const existingByEmail = new Map(
    existing.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id]),
  );

  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };

  for (const row of rows) {
    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();
    if (!firstName || !lastName) {
      summary.skipped++;
      continue;
    }

    const ownerId =
      userByEmail.get((row.ownerEmail ?? "").toLowerCase()) ?? session.user.id;

    const input: ContactInput = {
      ownerId,
      firstName,
      lastName,
      accountName: row.accountName || null,
      email: row.email || null,
      phone: row.phone || null,
      mobile: row.mobile || null,
      residentialPhone: row.residentialPhone || null,
      assistantPhone: row.assistantPhone || null,
      leadSource: row.leadSource || null,
      supplierName: row.supplierName || null,
      jobTitle: row.jobTitle || null,
      department: row.department || null,
      street: row.street || null,
      number: row.number || null,
      city: row.city || null,
      state: row.state || null,
      postalCode: row.postalCode || null,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
    };

    const existingId = row.email ? existingByEmail.get(row.email.toLowerCase()) : undefined;
    if (existingId) {
      await updateContact(session, existingId, input);
      summary.updated++;
    } else {
      await createContact(session, input);
      summary.created++;
    }
  }

  revalidatePath("/vendas");
  redirect(
    `/vendas?imported=${summary.created}-${summary.updated}-${summary.skipped}`,
  );
}

export async function sendContactWhatsAppAction(contactId: string, message: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canView(session.user.role, "vendas")) {
    return { error: "Sem permissão para acessar Clientes." };
  }
  try {
    await sendContactWhatsApp(session, contactId, message);
    revalidatePath("/vendas");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao enviar mensagem." };
  }
}

export async function assignableOwners(session: Session | null) {
  if (!session?.user) return [];
  if (!canEdit(session.user.role, "vendas")) return [];
  // Only cross-profile roles can reassign ownership away from themselves.
  const { scope } = getPermission(session.user.role, "vendas");
  if (scope === "own") {
    return prisma.user.findMany({
      where: { id: session.user.id },
      select: { id: true, name: true },
    });
  }
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
