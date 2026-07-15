import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/whatsapp";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The spec's permission matrix (docs/CRM-SPEC.md §6) distinguishes "team"
 * (Manager) from "all" (Admin/Mediador) scopes, but doesn't define a team/
 * hierarchy model yet — there's no manager->seller assignment to filter by.
 * Until that exists, both scopes see every non-deleted contact; "own" is
 * the only scope that actually restricts the query.
 */
function contactScopeWhere(session: Session): Prisma.ContactWhereInput {
  const { scope } = getPermission(session.user.role, "vendas");
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

export async function listContacts(session: Session) {
  return prisma.contact.findMany({
    where: { deletedAt: null, ...contactScopeWhere(session) },
    include: { owner: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContact(session: Session, id: string) {
  const contact = await prisma.contact.findFirst({
    where: { id, deletedAt: null, ...contactScopeWhere(session) },
    include: {
      owner: { select: { name: true, email: true } },
      deals: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { stage: { select: { name: true } } },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { actor: { select: { name: true } } },
      },
    },
  });
  return contact;
}

export type ContactInput = {
  ownerId: string;
  firstName: string;
  lastName: string;
  accountName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  residentialPhone?: string | null;
  assistantPhone?: string | null;
  leadSource?: string | null;
  supplierName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  street?: string | null;
  number?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function createContact(session: Session, data: ContactInput) {
  const contact = await prisma.contact.create({ data });
  await logActivity({
    actorId: session.user.id,
    entityType: "Contact",
    entityId: contact.id,
    action: "created",
    contactId: contact.id,
  });
  return contact;
}

export async function updateContact(
  session: Session,
  id: string,
  data: Partial<ContactInput>,
) {
  const before = await prisma.contact.findFirst({
    where: { id, ...contactScopeWhere(session) },
  });
  if (!before) throw new Error("Contato não encontrado ou sem permissão.");

  const contact = await prisma.contact.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id,
    entityType: "Contact",
    entityId: contact.id,
    action: "updated",
    contactId: contact.id,
    diff: { before, after: data } as Prisma.InputJsonValue,
  });
  return contact;
}

/** Sends a WhatsApp message to a contact using the CURRENT user's own
 * connected number (spec §3.6/§9) — each seller uses their own WhatsApp. */
export async function sendContactWhatsApp(session: Session, contactId: string, message: string) {
  const [contact, me] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, ...contactScopeWhere(session) },
      select: { mobile: true, phone: true },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { whatsappToken: true } }),
  ]);
  if (!contact) throw new Error("Cliente não encontrado ou sem permissão.");
  if (!isWhatsAppConfigured(me.whatsappToken)) {
    throw new Error("Seu WhatsApp ainda não está configurado. Peça para o mediador cadastrar no seu perfil.");
  }
  const phone = contact.mobile ?? contact.phone;
  if (!phone) throw new Error("Este cliente não tem telefone cadastrado.");

  await sendWhatsAppMessage(me.whatsappToken, phone, message);
  await logActivity({
    actorId: session.user.id,
    entityType: "Contact",
    entityId: contactId,
    action: "whatsapp_sent",
    contactId,
    diff: { outcome: message } as Prisma.InputJsonValue,
  });
}

export async function softDeleteContact(session: Session, id: string) {
  const contact = await prisma.contact.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await logActivity({
    actorId: session.user.id,
    entityType: "Contact",
    entityId: contact.id,
    action: "deleted",
    contactId: contact.id,
  });
  return contact;
}
