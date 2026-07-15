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
 * "coisas que esqueceu de fazer" surfaced separately from today's list. */
export async function getOverdueTasks(session: Session) {
  return prisma.task.findMany({
    where: {
      ...scopeWhere(session),
      done: false,
      dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    orderBy: { dueDate: "asc" },
    include: { owner: { select: { name: true } } },
  });
}

export async function createTask(session: Session, title: string, dueDate: Date | null) {
  if (!title.trim()) throw new Error("Descreva a tarefa.");
  return prisma.task.create({
    data: { ownerId: session.user.id, title: title.trim(), dueDate },
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
