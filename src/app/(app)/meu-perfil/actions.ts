"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateOwnProfile, enableMfa, disableMfa } from "@/lib/users";
import { generateMfaSecret, buildMfaSetup, verifyMfaToken } from "@/lib/mfa";

const MAX_AVATAR_LENGTH = 400_000;

export async function updateOwnProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Nome é obrigatório.");

  const avatarUrl = (formData.get("avatarUrl") as string)?.trim() || null;
  const password = (formData.get("password") as string)?.trim() || undefined;
  const birthdayStr = (formData.get("birthday") as string)?.trim();
  const birthday = birthdayStr ? new Date(birthdayStr) : null;
  const personalGoalStr = (formData.get("personalGoal") as string)?.trim();
  const personalGoal = personalGoalStr ? Number(personalGoalStr) : null;

  if (avatarUrl && avatarUrl.length > MAX_AVATAR_LENGTH) {
    throw new Error("Imagem muito grande. Escolha uma foto menor.");
  }

  await updateOwnProfile(session.user.id, { name, avatarUrl, birthday, personalGoal, password });
  revalidatePath("/", "layout");
}

/** Step 1 of turning on MFA: generates a secret and its QR code, but
 * doesn't persist anything yet — the secret only gets saved once
 * confirmMfaSetupAction verifies the user actually scanned it correctly,
 * so an abandoned setup never leaves a half-enabled state in the DB. */
export async function startMfaSetupAction(): Promise<{ secret: string; qrDataUrl: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const secret = generateMfaSecret();
  const { qrDataUrl } = await buildMfaSetup(secret, session.user.email ?? session.user.name ?? "usuário");
  return { secret, qrDataUrl };
}

export async function confirmMfaSetupAction(
  secret: string,
  code: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!verifyMfaToken(secret, code, session.user.email ?? "")) {
    return { error: "Código inválido. Confira o app autenticador e tente de novo." };
  }
  await enableMfa(session.user.id, secret);
  revalidatePath("/meu-perfil");
  return { ok: true };
}

export async function disableMfaAction(): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await disableMfa(session.user.id);
  revalidatePath("/meu-perfil");
}
