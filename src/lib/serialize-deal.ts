import type { Prisma } from "@/generated/prisma/client";

type DealWithRelations = Prisma.DealGetPayload<{
  include: {
    contact: { select: { firstName: true; lastName: true; accountName: true } };
    owner: { select: { name: true } };
    notes: true;
  };
}>;

/** Prisma's Decimal/Date instances aren't plain objects, so they can't cross the Server->Client Component boundary as-is. */
export function serializeDeal(deal: DealWithRelations) {
  return {
    ...deal,
    value: Number(deal.value),
    onTheWaySince: deal.onTheWaySince?.toISOString() ?? null,
    onTheWayDeadline: deal.onTheWayDeadline?.toISOString() ?? null,
    postSaleSentAt: deal.postSaleSentAt?.toISOString() ?? null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    deletedAt: deal.deletedAt?.toISOString() ?? null,
    notes: deal.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  };
}

export type SerializedDeal = ReturnType<typeof serializeDeal>;
