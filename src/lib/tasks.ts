import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

function scopeWhere(session: Session): Prisma.TaskWhereInput {
  const { scope } = getPermission(session.user.role, "agenda");
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

export async function listTasks(session: Session) {
  return prisma.task.findMany({
    where: scopeWhere(session),
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { owner: { select: { name: true } } },
  });
}

/** Tasks with a due date that's already passed and were never marked done —
 * "coisas que esqueceu de fazer" surfaced separately from today's list. Also
 * used to surface overdue scheduled deal messages (Task.dealId set) on the
 * Analítica home page, alongside plain agenda tasks. */
export async function getOverdueTasks(session: Session) {
  return prisma.task.findMany({
    where: {
      ...scopeWhere(session),
      done: false,
      dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    orderBy: { dueDate: "asc" },
    include: { owner: { select: { name: true } }, deal: { select: { name: true } } },
  });
}

/** Lightweight count backing the "Agenda" nav badge (Sidebar) — same scope
 * as getOverdueTasks, just without fetching full rows on every page. */
export async function getOverdueTaskCount(session: Session): Promise<number> {
  return prisma.task.count({
    where: {
      ...scopeWhere(session),
      done: false,
      dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });
}

const SELLER_OVERDUE_ALERT_THRESHOLD = 5;

/** Mediator-only radar: sellers piling up overdue tasks/agendamentos (5+ in
 * total, regardless of how old) — surfaced on Início so a mediator can step
 * in before it gets worse. Scoped to MEDIATOR since it crosses every
 * seller's data; returns [] for any other role. */
export async function getOverdueSellerAlerts(
  session: Session,
): Promise<Array<{ ownerId: string; ownerName: string; count: number }>> {
  if (session.user.role !== "MEDIATOR") return [];

  const grouped = await prisma.task.groupBy({
    by: ["ownerId"],
    where: { done: false, dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
    _count: { _all: true },
  });
  const relevant = grouped.filter((g) => g._count._all >= SELLER_OVERDUE_ALERT_THRESHOLD);
  if (relevant.length === 0) return [];

  const owners = await prisma.user.findMany({
    where: { id: { in: relevant.map((r) => r.ownerId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(owners.map((o) => [o.id, o.name]));

  return relevant
    .map((r) => ({ ownerId: r.ownerId, ownerName: nameById.get(r.ownerId) ?? "—", count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function createTask(
  session: Session,
  title: string,
  dueDate: Date | null,
  dealId: string | null = null,
  prospectId: string | null = null,
) {
  if (!title.trim()) throw new Error("Descreva a tarefa.");
  return prisma.task.create({
    data: { ownerId: session.user.id, title: title.trim(), dueDate, dealId, prospectId },
  });
}

/** Scheduled messages for a specific negócio — a Task with dealId set,
 * shown in the deal's quick-view modal / standalone page. */
export async function getDealTasks(session: Session, dealId: string) {
  return prisma.task.findMany({
    where: { ...scopeWhere(session), dealId },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }],
  });
}

export async function toggleTask(session: Session, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, ...scopeWhere(session) } });
  if (!task) throw new Error("Tarefa não encontrada ou sem permissão.");
  return prisma.task.update({
    where: { id: taskId },
    data: { done: !task.done, doneAt: !task.done ? new Date() : null },
  });
}

export async function deleteTask(session: Session, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, ...scopeWhere(session) } });
  if (!task) throw new Error("Tarefa não encontrada ou sem permissão.");
  await prisma.task.delete({ where: { id: taskId } });
}
