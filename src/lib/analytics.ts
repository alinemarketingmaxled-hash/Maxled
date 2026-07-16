import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission, seesOtherUsers, type Module } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

function dealScopeWhere(session: Session, mod: Module = "analitica"): Prisma.DealWhereInput {
  const { scope } = getPermission(session.user.role, mod);
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfNextMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export async function getKpis(session: Session, referenceDate: Date = new Date()) {
  const scope = dealScopeWhere(session);
  const now = referenceDate;
  const thisMonth = { gte: startOfMonth(now), lt: startOfNextMonth(now) };
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = startOfMonth(now);

  const [wonThisMonth, wonLastMonth, allThisMonth] = await Promise.all([
    prisma.deal.findMany({
      where: { ...scope, deletedAt: null, stage: { isWon: true }, updatedAt: thisMonth },
      select: { value: true },
    }),
    prisma.deal.findMany({
      where: {
        ...scope,
        deletedAt: null,
        stage: { isWon: true },
        updatedAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
      select: { value: true },
    }),
    prisma.deal.count({ where: { ...scope, deletedAt: null, createdAt: thisMonth } }),
  ]);

  const revenue = wonThisMonth.reduce((s, d) => s + Number(d.value), 0);
  const revenueLastMonth = wonLastMonth.reduce((s, d) => s + Number(d.value), 0);
  const revenueDelta = revenueLastMonth > 0 ? ((revenue - revenueLastMonth) / revenueLastMonth) * 100 : null;

  const avgTicket = wonThisMonth.length > 0 ? revenue / wonThisMonth.length : 0;
  const conversionRate = allThisMonth > 0 ? (wonThisMonth.length / allThisMonth) * 100 : 0;

  return {
    revenue,
    revenueDelta,
    dealsWon: wonThisMonth.length,
    avgTicket,
    conversionRate,
  };
}

export async function getRevenueByMonth(session: Session, months = 6) {
  const scope = dealScopeWhere(session);
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const deals = await prisma.deal.findMany({
    where: { ...scope, deletedAt: null, stage: { isWon: true }, updatedAt: { gte: from } },
    select: { value: true, updatedAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
  }
  for (const deal of deals) {
    const d = deal.updatedAt;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(deal.value));
  }

  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return Array.from(buckets.entries()).map(([key, value]) => {
    const [, month] = key.split("-").map(Number);
    return { label: labels[month], value };
  });
}

export async function getFunnel(session: Session) {
  const scope = dealScopeWhere(session);
  const pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: { _count: { select: { deals: { where: { ...scope, deletedAt: null } } } } },
      },
    },
  });
  return pipeline?.stages.map((s) => ({ name: s.name, count: s._count.deals })) ?? [];
}

/** Commission unlocks at whichever goal tier the achieved total reaches
 * (higher tier wins) — shared by getGoalProgress (self) and
 * getTeamPerformance (everyone, for the mediator/manager view). */
function computeCommission(
  achieved: number,
  goal1: number | null,
  goal2: number | null,
  commissionPct1: number | null,
  commissionPct2: number | null,
): number {
  if (goal2 !== null && commissionPct2 !== null && achieved >= goal2) {
    return achieved * (commissionPct2 / 100);
  }
  if (goal1 !== null && commissionPct1 !== null && achieved >= goal1) {
    return achieved * (commissionPct1 / 100);
  }
  return 0;
}

export async function getGoalProgress(session: Session, referenceDate: Date = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      goal1: true,
      goal2: true,
      commissionPct1: true,
      commissionPct2: true,
      personalGoal: true,
      name: true,
    },
  });
  if (!user || (!user.goal1 && !user.goal2 && !user.personalGoal)) return null;

  const now = referenceDate;
  const wonThisMonth = await prisma.deal.findMany({
    where: {
      ownerId: session.user.id,
      deletedAt: null,
      stage: { isWon: true },
      updatedAt: { gte: startOfMonth(now), lt: startOfNextMonth(now) },
    },
    select: { value: true },
  });
  const achieved = wonThisMonth.reduce((s, d) => s + Number(d.value), 0);

  const goal1 = user.goal1 ? Number(user.goal1) : null;
  const goal2 = user.goal2 ? Number(user.goal2) : null;
  const commissionPct1 = user.commissionPct1 ? Number(user.commissionPct1) : null;
  const commissionPct2 = user.commissionPct2 ? Number(user.commissionPct2) : null;
  const personalGoal = user.personalGoal ? Number(user.personalGoal) : null;

  const commissionEarned = computeCommission(achieved, goal1, goal2, commissionPct1, commissionPct2);

  return {
    name: user.name,
    achieved,
    goal1,
    goal2,
    commissionPct1,
    commissionPct2,
    commissionEarned,
    personalGoal,
  };
}

export type SellerPerformance = {
  id: string;
  name: string;
  achieved: number;
  commissionEarned: number;
};

/**
 * Per-seller faturamento + comissão for the mediator/manager card — only
 * meaningful for scopes that see other users' data (spec's "team"/"all"),
 * so returns null for a seller looking at their own numbers (they already
 * have that in getGoalProgress).
 */
export async function getTeamPerformance(
  session: Session,
  referenceDate: Date = new Date(),
): Promise<SellerPerformance[] | null> {
  if (!seesOtherUsers(session.user.role, "analitica")) return null;

  const now = referenceDate;
  const sellers = await prisma.user.findMany({
    where: { deletedAt: null, role: "SELLER" },
    select: { id: true, name: true, goal1: true, goal2: true, commissionPct1: true, commissionPct2: true },
    orderBy: { name: "asc" },
  });
  if (sellers.length === 0) return [];

  const wonDeals = await prisma.deal.groupBy({
    by: ["ownerId"],
    where: {
      ownerId: { in: sellers.map((s) => s.id) },
      deletedAt: null,
      stage: { isWon: true },
      updatedAt: { gte: startOfMonth(now), lt: startOfNextMonth(now) },
    },
    _sum: { value: true },
  });
  const achievedByOwner = new Map(wonDeals.map((d) => [d.ownerId, Number(d._sum.value ?? 0)]));

  return sellers
    .map((s) => {
      const achieved = achievedByOwner.get(s.id) ?? 0;
      const goal1 = s.goal1 ? Number(s.goal1) : null;
      const goal2 = s.goal2 ? Number(s.goal2) : null;
      const commissionPct1 = s.commissionPct1 ? Number(s.commissionPct1) : null;
      const commissionPct2 = s.commissionPct2 ? Number(s.commissionPct2) : null;
      return {
        id: s.id,
        name: s.name,
        achieved,
        commissionEarned: computeCommission(achieved, goal1, goal2, commissionPct1, commissionPct2),
      };
    })
    .sort((a, b) => b.achieved - a.achieved);
}
