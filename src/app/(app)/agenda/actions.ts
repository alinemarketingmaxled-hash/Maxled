"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEdit } from "@/lib/permissions";
import { createTask, toggleTask, deleteTask } from "@/lib/tasks";

async function requireEdit() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit(session.user.role, "agenda")) {
    throw new Error("Sem permissão para editar a Agenda.");
  }
  return session;
}

export async function createTaskAction(title: string, dueDate: string) {
  const session = await requireEdit();
  await createTask(session, title, dueDate ? new Date(dueDate) : null);
  revalidatePath("/agenda");
}

export async function toggleTaskAction(taskId: string) {
  const session = await requireEdit();
  await toggleTask(session, taskId);
  revalidatePath("/agenda");
}

export async function deleteTaskAction(taskId: string) {
  const session = await requireEdit();
  await deleteTask(session, taskId);
  revalidatePath("/agenda");
}
