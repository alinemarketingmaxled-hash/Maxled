"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { answersSchema, bioSchema, workoutLogSchema } from "@/lib/fit/schema";
import { readBioReport, readBodyPhoto, type BodyReading, type ReportReading } from "@/lib/fit/vision";
import type { BioInput, FitAnswers } from "@/lib/fit/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Faça login para continuar.");
  return session.user.id;
}

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Algo deu errado." };
}

export async function saveAnswersAction(input: FitAnswers, restartProgram: boolean): Promise<Result> {
  try {
    const userId = await requireUserId();
    const parsed = answersSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Respostas inválidas." };
    await prisma.fitProfile.upsert({
      where: { userId },
      create: { userId, answers: parsed.data },
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
    await requireUserId();
    return { ok: true, data: await readBioReport(dataUrl) };
  } catch (e) {
    return fail(e);
  }
}

export async function scanBodyPhotoAction(dataUrl: string): Promise<Result<BodyReading>> {
  try {
    const userId = await requireUserId();
    const profile = await prisma.fitProfile.findUnique({ where: { userId } });
    const parsed = answersSchema.safeParse(profile?.answers);
    if (!parsed.success) return { ok: false, error: "Responda o questionário primeiro." };
    const last = await prisma.fitBioRecord.findFirst({ where: { userId }, orderBy: { measuredAt: "desc" } });
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
    const userId = await requireUserId();
    const parsed = bioSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: `Valor inválido em "${parsed.error.issues[0]?.path.join(".")}".` };
    const measuredAt = new Date(parsed.data.measuredAt);
    if (Number.isNaN(measuredAt.getTime())) return { ok: false, error: "Data inválida." };
    await prisma.fitBioRecord.create({ data: { ...parsed.data, measuredAt, userId } });
    revalidatePath("/fit", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBioAction(id: string): Promise<Result> {
  try {
    const userId = await requireUserId();
    await prisma.fitBioRecord.deleteMany({ where: { id, userId } });
    revalidatePath("/fit", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function saveWorkoutAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const parsed = workoutLogSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Registro de treino inválido." };
    const row = await prisma.fitWorkoutLog.create({ data: { ...parsed.data, userId } });
    revalidatePath("/fit", "layout");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWorkoutAction(id: string): Promise<Result> {
  try {
    const userId = await requireUserId();
    await prisma.fitWorkoutLog.deleteMany({ where: { id, userId } });
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
