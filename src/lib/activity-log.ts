import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export async function logActivity(params: {
  actorId: string;
  entityType: "Contact" | "Deal" | "PipelineStage" | "User" | "Prospect";
  entityId: string;
  action: "created" | "updated" | "deleted" | "restored" | "stage_changed" | "call_logged" | "unlocked";
  diff?: Prisma.InputJsonValue;
  contactId?: string;
  dealId?: string;
}) {
  await prisma.activityLog.create({
    data: {
      actorId: params.actorId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      diff: params.diff,
      contactId: params.contactId,
      dealId: params.dealId,
    },
  });
}

export type ActivityFilters = { actorId?: string; action?: string };

/** Powers the Config page's activity feed — scoped by the "activityLogs"
 * permission (own/team/all), same pattern as every other module. actorId/
 * action narrow it further for the audit filters, on top of that scope —
 * a "own" scoped seller filtering by actorId just gets their own logs back
 * either way, since scopeWhere already pins actorId to themselves. */
export async function listActivity(session: Session, filters: ActivityFilters = {}, take = 100) {
  const { scope } = getPermission(session.user.role, "activityLogs");
  const where: Prisma.ActivityLogWhereInput = {
    ...(scope === "own" ? { actorId: session.user.id } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
  };

  return prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      deal: { select: { name: true } },
    },
  });
}
