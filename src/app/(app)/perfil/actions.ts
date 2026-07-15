"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEdit } from "@/lib/permissions";
import { createVendor, updateVendor, deactivateVendor, type VendorInput } from "@/lib/users";
import type { Role } from "@/generated/prisma/client";

async function requireMediator() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit(session.user.role, "perfil")) {
    throw new Error("Apenas o mediador pode editar perfis.");
  }
  return session;
}

function readVendorInput(formData: FormData): VendorInput {
  const str = (key: string) => (formData.get(key) as string)?.trim() || null;
  const num = (key: string) => {
    const v = str(key);
    return v ? Number(v) : null;
  };
  const birthday = str("birthday");

  return {
    name: (formData.get("name") as string)?.trim() ?? "",
    email: (formData.get("email") as string)?.trim() ?? "",
    role: (formData.get("role") as Role) ?? "SELLER",
    jobTitle: str("jobTitle"),
    birthday: birthday ? new Date(birthday) : null,
    goal1: num("goal1"),
    goal2: num("goal2"),
    commissionPct1: num("commissionPct1"),
    commissionPct2: num("commissionPct2"),
    password: (formData.get("password") as string)?.trim() || undefined,
  };
}

function friendlyError(e: unknown): string {
  if (e instanceof Error) {
    // Prisma unique constraint violation (e.g. duplicate e-mail).
    if ("code" in e && e.code === "P2002") return "Já existe um vendedor com esse e-mail.";
    return e.message;
  }
  return "Erro inesperado ao salvar o vendedor.";
}

export async function createVendorAction(formData: FormData) {
  const session = await requireMediator();
  const input = readVendorInput(formData);
  if (!input.name || !input.email) return { error: "Nome e e-mail são obrigatórios." };

  try {
    await createVendor(session.user.id, input);
  } catch (e) {
    return { error: friendlyError(e) };
  }
  revalidatePath("/perfil");
  return { ok: true };
}

export async function updateVendorAction(id: string, formData: FormData) {
  const session = await requireMediator();
  const input = readVendorInput(formData);

  try {
    await updateVendor(session.user.id, id, input);
  } catch (e) {
    return { error: friendlyError(e) };
  }
  revalidatePath("/perfil");
  return { ok: true };
}

export async function deactivateVendorAction(id: string) {
  const session = await requireMediator();
  await deactivateVendor(session.user.id, id);
  revalidatePath("/perfil");
  redirect("/perfil");
}
