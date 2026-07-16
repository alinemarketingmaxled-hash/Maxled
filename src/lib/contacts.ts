import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import type { Prisma, PersonType, CommercialPotential, CrmStatus } from "@/generated/prisma/client";

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
        include: { stage: { select: { name: true, isWon: true, isOnTheWay: true } } },
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

const DAY_MS = 1000 * 60 * 60 * 24;
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

export type ContactInsights = {
  valorComprado: number;
  quantidadeComprada: number;
  ticketMedio: number;
  diasSemContato: number | null;
  diasAteAniversario: number | null;
  etapaFunil: string | null;
  abcClass: "A" | "B" | "C" | null;
  prioridade: "alta" | "média" | "baixa";
  acaoRecomendada: string;
};

/**
 * Every number here is grounded in real Deal records (spec request: "os
 * valores precisam ser um negócio, no histórico") — valorComprado/
 * quantidadeComprada are literally the sum/count of the won deals already
 * listed in the contact's history, never a standalone figure.
 */
export function computeContactInsights(
  contact: {
    deals: Array<{ value: Prisma.Decimal | number; stage: { name: string; isWon: boolean; isOnTheWay: boolean } }>;
    lastContactedAt: Date | null;
    createdAt: Date;
    birthday: Date | null;
  },
  abcClass: "A" | "B" | "C" | null,
): ContactInsights {
  const wonDeals = contact.deals.filter((d) => d.stage.isWon);
  const valorComprado = wonDeals.reduce((s, d) => s + Number(d.value), 0);
  const quantidadeComprada = wonDeals.length;
  const ticketMedio = quantidadeComprada > 0 ? valorComprado / quantidadeComprada : 0;

  const diasSemContato = contact.lastContactedAt
    ? daysSince(contact.lastContactedAt)
    : daysSince(contact.createdAt);

  let diasAteAniversario: number | null = null;
  if (contact.birthday) {
    const today = new Date();
    const next = new Date(today.getFullYear(), contact.birthday.getMonth(), contact.birthday.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    diasAteAniversario = Math.ceil((next.getTime() - today.getTime()) / DAY_MS);
  }

  const openDeal = contact.deals.find((d) => !d.stage.isWon);
  const etapaFunil = openDeal?.stage.name ?? (wonDeals.length > 0 ? wonDeals[0].stage.name : null);

  let prioridade: ContactInsights["prioridade"] = "baixa";
  let acaoRecomendada = "Nenhuma ação necessária no momento.";

  if (diasSemContato > 180 && quantidadeComprada > 0) {
    prioridade = "alta";
    acaoRecomendada = "Ligar urgentemente — cliente sem contato há mais de 6 meses.";
  } else if (openDeal && !openDeal.stage.isOnTheWay) {
    prioridade = "média";
    acaoRecomendada = `Dar andamento ao negócio em "${openDeal.stage.name}".`;
  } else if (diasSemContato > 30) {
    prioridade = "média";
    acaoRecomendada = "Fazer um contato de rotina.";
  }

  return {
    valorComprado,
    quantidadeComprada,
    ticketMedio,
    diasSemContato,
    diasAteAniversario,
    etapaFunil,
    abcClass,
    prioridade,
    acaoRecomendada,
  };
}

/**
 * Classic ABC/Pareto split by real purchased value: contacts making up the
 * first 80% of cumulative revenue are A, the next 15% are B, the rest C.
 * Computed across the same scope a seller would see in Clientes.
 */
export async function getAbcClasses(session: Session): Promise<Map<string, "A" | "B" | "C">> {
  const contacts = await prisma.contact.findMany({
    where: { deletedAt: null, ...contactScopeWhere(session) },
    select: {
      id: true,
      deals: { where: { deletedAt: null, stage: { isWon: true } }, select: { value: true } },
    },
  });

  const totals = contacts
    .map((c) => ({ id: c.id, total: c.deals.reduce((s, d) => s + Number(d.value), 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const grandTotal = totals.reduce((s, c) => s + c.total, 0);
  const classes = new Map<string, "A" | "B" | "C">();
  let cumulative = 0;
  for (const c of totals) {
    cumulative += c.total;
    const pct = grandTotal > 0 ? cumulative / grandTotal : 0;
    classes.set(c.id, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
  }
  return classes;
}

export type ContactInput = {
  ownerId: string;
  personType?: PersonType | null;
  firstName: string;
  lastName: string;
  accountName?: string | null;
  cnpj?: string | null;
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
  birthday?: Date | null;
  commercialPotential?: CommercialPotential | null;
  crmStatus?: CrmStatus | null;
  nextContactAt?: Date | null;
  notes?: string | null;
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
