import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import type { Prisma } from "@/generated/prisma/client";

const FOLLOW_UP_DAYS = 5;
const URGENT_DAYS = 180;
const DAY_MS = 1000 * 60 * 60 * 24;

function contactScopeWhere(session: Session): Prisma.ContactWhereInput {
  const { scope } = getPermission(session.user.role, "analitica");
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

export type CallTask = {
  contactId: string;
  contactName: string;
  phone: string | null;
  reason: string;
};

export type DailyTasks = {
  toCall: CallTask[];
  toQuote: CallTask[];
  urgent: CallTask[];
};

/**
 * "Coisas para fazer hoje": follow-up calls, deals still needing a
 * quote/order sent, and reactivation calls for customers gone quiet 6+
 * months. Heuristics only — grounded in real Contact/Deal timestamps,
 * no AI involved.
 */
export async function getDailyTasks(session: Session): Promise<DailyTasks> {
  const scope = contactScopeWhere(session);
  const cutoffFollowUp = new Date(Date.now() - FOLLOW_UP_DAYS * DAY_MS);
  const cutoffUrgent = new Date(Date.now() - URGENT_DAYS * DAY_MS);

  const [openDeals, firstStage] = await Promise.all([
    prisma.deal.findMany({
      where: {
        deletedAt: null,
        stage: { isWon: false },
        contact: { ...scope, deletedAt: null },
      },
      include: { contact: true },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.pipelineStage.findFirst({
      where: { isWon: false, isOnTheWay: false },
      orderBy: { order: "asc" },
      select: { id: true },
    }),
  ]);

  const toCall: CallTask[] = [];
  const toQuote: CallTask[] = [];
  const seenToCall = new Set<string>();
  const seenToQuote = new Set<string>();

  for (const deal of openDeals) {
    const c = deal.contact;
    const name = c.accountName || `${c.firstName} ${c.lastName}`;
    const lastContact = c.lastContactedAt ?? c.createdAt;

    if (lastContact < cutoffFollowUp && !seenToCall.has(c.id)) {
      toCall.push({
        contactId: c.id,
        contactName: name,
        phone: c.mobile ?? c.phone,
        reason: `Negócio "${deal.name}" sem contato há ${daysSince(lastContact)} dias`,
      });
      seenToCall.add(c.id);
    }

    if (firstStage && deal.stageId === firstStage.id && !seenToQuote.has(c.id)) {
      toQuote.push({
        contactId: c.id,
        contactName: name,
        phone: c.mobile ?? c.phone,
        reason: `Negócio "${deal.name}" ainda sem pedido/cotação enviada`,
      });
      seenToQuote.add(c.id);
    }
  }

  const pastCustomers = await prisma.contact.findMany({
    where: {
      ...scope,
      deletedAt: null,
      deals: { some: { deletedAt: null, stage: { isWon: true } } },
    },
    take: 50,
  });

  const urgent: CallTask[] = pastCustomers
    .filter((c) => (c.lastContactedAt ?? c.createdAt) < cutoffUrgent)
    .map((c) => {
      const lastContact = c.lastContactedAt ?? c.createdAt;
      const months = Math.floor(daysSince(lastContact) / 30);
      return {
        contactId: c.id,
        contactName: c.accountName || `${c.firstName} ${c.lastName}`,
        phone: c.mobile ?? c.phone,
        reason: `Cliente sem contato há ${months} meses — risco de perda`,
      };
    })
    .sort((a, b) => b.reason.localeCompare(a.reason));

  return {
    toCall: toCall.slice(0, 8),
    toQuote: toQuote.slice(0, 8),
    urgent: urgent.slice(0, 8),
  };
}

export async function logCallOutcome(session: Session, contactId: string, outcome: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, ...contactScopeWhere(session) },
  });
  if (!contact) throw new Error("Cliente não encontrado ou sem permissão.");

  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactedAt: new Date() },
  });

  await logActivity({
    actorId: session.user.id,
    entityType: "Contact",
    entityId: contactId,
    action: "call_logged",
    contactId,
    diff: { outcome } as Prisma.InputJsonValue,
  });
}
