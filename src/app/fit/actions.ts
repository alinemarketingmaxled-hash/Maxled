"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signOut } from "@/auth";
import { currentFitAccount } from "@/lib/fit/account";
import { prisma } from "@/lib/prisma";
import { answersSchema, bioSchema, workoutLogSchema } from "@/lib/fit/schema";
import { getExercise } from "@/lib/fit/exercises";
import { readBioReport, readBodyPhoto, type BodyReading, type ReportReading } from "@/lib/fit/vision";
import type { BioInput, FitAnswers } from "@/lib/fit/types";

async function requireAccountId(): Promise<string> {
  const account = await currentFitAccount();
  if (!account) throw new Error("Faça login para continuar.");
  return account.id;
}

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Algo deu errado." };
}

export async function saveAnswersAction(input: FitAnswers, restartProgram: boolean): Promise<Result> {
  try {
    const accountId = await requireAccountId();
    const parsed = answersSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Respostas inválidas." };
    await prisma.fitProfile.upsert({
      where: { accountId },
      create: { accountId, answers: parsed.data },
      update: { answers: parsed.data, ...(restartProgram ? { startedAt: new Date() } : {}) },
    });
    revalidatePath("/fit", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function scanBioReportAction(dataUrl: string): Promise<Result<ReportReading>> {
  try {
    await requireAccountId();
    return { ok: true, data: await readBioReport(dataUrl) };
  } catch (e) {
    return fail(e);
  }
}

export async function scanBodyPhotoAction(dataUrl: string): Promise<Result<BodyReading>> {
  try {
    const accountId = await requireAccountId();
    const profile = await prisma.fitProfile.findUnique({ where: { accountId } });
    const parsed = answersSchema.safeParse(profile?.answers);
    if (!parsed.success) return { ok: false, error: "Responda o questionário primeiro." };
    const last = await prisma.fitBioRecord.findFirst({ where: { accountId }, orderBy: { measuredAt: "desc" } });
    return {
      ok: true,
      data: await readBodyPhoto(dataUrl, {
        sex: parsed.data.sex,
        heightCm: parsed.data.heightCm,
        weightKg: last?.weightKg ?? parsed.data.weightKg,
      }),
    };
  } catch (e) {
    return fail(e);
  }
}

export async function addBioAction(input: BioInput): Promise<Result> {
  try {
    const accountId = await requireAccountId();
    const parsed = bioSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: `Valor inválido em "${parsed.error.issues[0]?.path.join(".")}".` };
    const measuredAt = new Date(parsed.data.measuredAt);
    if (Number.isNaN(measuredAt.getTime())) return { ok: false, error: "Data inválida." };
    const { image, ...fields } = parsed.data;
    const img = image?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    await prisma.fitBioRecord.create({
      data: {
        ...fields,
        measuredAt,
        accountId,
        ...(img ? { image: { create: { mimeType: img[1], data: Buffer.from(img[2], "base64") } } } : {}),
      },
    });
    revalidatePath("/fit", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBioAction(id: string): Promise<Result> {
  try {
    const accountId = await requireAccountId();
    await prisma.fitBioRecord.deleteMany({ where: { id, accountId } });
    revalidatePath("/fit", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function saveWorkoutAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const accountId = await requireAccountId();
    const parsed = workoutLogSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Registro de treino inválido." };
    const row = await prisma.fitWorkoutLog.create({ data: { ...parsed.data, accountId } });
    revalidatePath("/fit", "layout");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWorkoutAction(id: string): Promise<Result> {
  try {
    const accountId = await requireAccountId();
    await prisma.fitWorkoutLog.deleteMany({ where: { id, accountId } });
    revalidatePath("/fit", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function setFitThemeAction(theme: "dark" | "light"): Promise<void> {
  const store = await cookies();
  store.set("fit-theme", theme === "light" ? "light" : "dark", { path: "/fit", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/fit", "layout");
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(100),
});

/** Creates a Maxled Fit account. The client signs in right after with the
 * "fit" credentials provider. */
export async function signUpFitAction(input: { name: string; email: string; password: string }): Promise<Result> {
  try {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const { name, email, password } = parsed.data;
    const exists = await prisma.fitAccount.findUnique({ where: { email } });
    if (exists) return { ok: false, error: "Já existe uma conta com este e-mail. Entre com sua senha." };
    await prisma.fitAccount.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function signOutFitAction() {
  await signOut({ redirectTo: "/fit/entrar" });
}

/** "Não quero este" / "Manter sempre" / back to neutral for one exercise.
 * Stored in the questionnaire answers, so the generator swaps it right away. */
export async function setExercisePreferenceAction(exerciseId: string, pref: "excluir" | "manter" | "neutro"): Promise<Result> {
  try {
    const accountId = await requireAccountId();
    if (!getExercise(exerciseId)) return { ok: false, error: "Exercício não encontrado." };
    const profile = await prisma.fitProfile.findUnique({ where: { accountId } });
    const parsed = answersSchema.safeParse(profile?.answers);
    if (!parsed.success) return { ok: false, error: "Responda o questionário primeiro." };
    const a = parsed.data;
    const excluded = a.excludedExercises.filter((x) => x !== exerciseId);
    const favorite = a.favoriteExercises.filter((x) => x !== exerciseId);
    if (pref === "excluir") excluded.push(exerciseId);
    if (pref === "manter") favorite.push(exerciseId);
    await prisma.fitProfile.update({
      where: { accountId },
      data: { answers: { ...a, excludedExercises: excluded, favoriteExercises: favorite } },
    });
    revalidatePath("/fit", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
