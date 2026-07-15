import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function logActivity(params: {
  actorId: string;
  entityType: "Contact" | "Deal" | "PipelineStage" | "User";
  entityId: string;
  action: "created" | "updated" | "deleted" | "restored" | "stage_changed" | "call_logged";
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
