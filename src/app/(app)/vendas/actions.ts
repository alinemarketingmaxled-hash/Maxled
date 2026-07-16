"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { PersonType, CommercialPotential, CrmStatus } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { canEdit, getPermission } from "@/lib/permissions";
import {
  createContact,
  updateContact,
  softDeleteContact,
  listContacts,
  type ContactInput,
} from "@/lib/contacts";
import { lookupCnpj, type CnpjLookupResult } from "@/lib/cnpj-lookup";
import { prisma } from "@/lib/prisma";
import { parseCsv, parseBrDate, type ImportSummary } from "@/lib/csv";

const PERSON_TYPES: PersonType[] = ["FISICA", "JURIDICA"];
const COMMERCIAL_POTENTIALS: CommercialPotential[] = ["ALTO", "MEDIO", "BAIXO"];
const CRM_STATUSES: CrmStatus[] = ["LEAD", "ATIVO", "INATIVO"];

function readEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function readDateInput(formData: FormData, key: string): Date | null {
  const v = (formData.get(key) as string) || "";
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Maps free-text CSV values (Portuguese labels, the enum names themselves,
 * or common abbreviations) onto the strict enum values — messy imports
 * shouldn't silently drop a column just because the label doesn't match
 * exactly. */
function normalizePersonType(value: string | undefined): string | null {
  const v = (value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!v) return null;
  if (v.includes("juridic") || v === "pj" || v.includes("empresa")) return "JURIDICA";
  if (v.includes("fisic") || v === "pf" || v.includes("pessoa")) return "FISICA";
  return null;
}

function normalizePotential(value: string | undefined): string | null {
  const v = (value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!v) return null;
  if (v.includes("alto")) return "ALTO";
  if (v.includes("medio")) return "MEDIO";
  if (v.includes("baixo")) return "BAIXO";
  return null;
}

function normalizeCrmStatus(value: string | undefined): string | null {
  const v = (value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!v) return null;
  if (v.includes("lead")) return "LEAD";
  if (v.includes("ativo") && !v.includes("inativo")) return "ATIVO";
  if (v.includes("inativo")) return "INATIVO";
  return null;
}

function readContactInput(formData: FormData, ownerId: string): ContactInput {
  const str = (key: string) => (formData.get(key) as string)?.trim() || null;
  const lat = str("latitude");
  const lng = str("longitude");

  return {
    ownerId,
    personType: readEnum(str("personType"), PERSON_TYPES),
    firstName: (formData.get("firstName") as string)?.trim() ?? "",
    lastName: (formData.get("lastName") as string)?.trim() ?? "",
    accountName: str("accountName"),
    cnpj: str("cnpj"),
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
    birthday: readDateInput(formData, "birthday"),
    commercialPotential: readEnum(str("commercialPotential"), COMMERCIAL_POTENTIALS),
    crmStatus: readEnum(str("crmStatus"), CRM_STATUSES),
    nextContactAt: readDateInput(formData, "nextContactAt"),
    notes: str("notes"),
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

/** Backs the "Buscar CNPJ" button in ContactForm — looks up company data
 * from BrasilAPI (free, no key) so a bare CNPJ can auto-fill the rest of
 * the form instead of the user retyping it. */
export async function lookupCnpjAction(cnpj: string): Promise<CnpjLookupResult | null> {
  await requireEdit();
  return lookupCnpj(cnpj);
}

export async function deleteContactAction(id: string) {
  const session = await requireEdit();
  await softDeleteContact(session, id);
  revalidatePath("/vendas");
  redirect("/vendas");
}

function friendlyImportError(e: unknown): string {
  if (e instanceof Error) {
    if ("code" in e && e.code === "P2002") return "Um dos clientes da planilha já existe com esses dados.";
    return `Erro ao importar: ${e.message}`;
  }
  return "Erro inesperado ao importar a planilha.";
}

/**
 * Round-trips the CSV produced by /vendas/export: matches existing contacts
 * by e-mail (spec's "duplicate detection on import" recommendation) so a
 * re-import updates rather than duplicates, and resolves ownerEmail back to
 * a real owner, falling back to the importing user when no match is found.
 *
 * Returns {error}/{summary} instead of throwing/redirecting — an uncaught
 * exception here would crash to Next.js's generic error page (the same bug
 * fixed for Perfil), leaving no way to tell what actually went wrong.
 */
export async function importContactsAction(
  formData: FormData,
): Promise<{ error?: string; summary?: ImportSummary }> {
  const session = await requireEdit();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo CSV." };

  try {
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
        personType: readEnum(normalizePersonType(row.personType), PERSON_TYPES),
        firstName,
        lastName,
        accountName: row.accountName || null,
        cnpj: row.cnpj || null,
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
        birthday: row.birthday ? parseBrDate(row.birthday) : null,
        commercialPotential: readEnum(normalizePotential(row.commercialPotential), COMMERCIAL_POTENTIALS),
        crmStatus: readEnum(normalizeCrmStatus(row.crmStatus), CRM_STATUSES),
        nextContactAt: row.nextContactAt ? parseBrDate(row.nextContactAt) : null,
        notes: row.notes || null,
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
    return { summary };
  } catch (e) {
    return { error: friendlyImportError(e) };
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
