"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateOwnProfile } from "@/lib/users";

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
