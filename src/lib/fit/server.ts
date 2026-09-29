import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { analyzeBio, type BioAnalysis } from "./bio";
import { nutritionPlan, type NutritionPlan } from "./nutrition";
import { currentWeek, generateWeek, trainingWeekdays, type WeekPlan } from "./program";
import { answersSchema } from "./schema";
import { streakDays } from "./progression";
import { achievements, type Achievement } from "./achievements";
import type { BioRecord, FitAnswers, WorkoutLog } from "./types";

export { requireFitAccount } from "./account";
import { requireFitAccount } from "./account";

const BIO_INCLUDE = { image: { select: { id: true } } } as const;
type BioRow = Awaited<ReturnType<typeof prisma.fitBioRecord.findMany<{ include: typeof BIO_INCLUDE }>>>[number];
type LogRow = Awaited<ReturnType<typeof prisma.fitWorkoutLog.findMany>>[number];

function toBio(r: BioRow): BioRecord {
  return {
    id: r.id,
    measuredAt: r.measuredAt.toISOString(),
    source: (r.source as BioRecord["source"]) ?? "manual",
    weightKg: r.weightKg,
    bodyFatPct: r.bodyFatPct,
    muscleMassKg: r.muscleMassKg,
    leanMassKg: r.leanMassKg,
    visceralFat: r.visceralFat,
    waterPct: r.waterPct,
    boneMassKg: r.boneMassKg,
    bmrKcal: r.bmrKcal,
    metabolicAge: r.metabolicAge,
    waistCm: r.waistCm,
    hipCm: r.hipCm,
    chestCm: r.chestCm,
    armCm: r.armCm,
    thighCm: r.thighCm,
    notes: r.notes,
    hasImage: !!r.image,
  };
}

function toLog(r: LogRow): WorkoutLog {
  return {
    id: r.id,
    performedAt: r.performedAt.toISOString(),
    weekNumber: r.weekNumber,
    dayIndex: r.dayIndex,
    title: r.title,
    durationMin: r.durationMin,
    rpe: r.rpe,
    entries: (r.entries as WorkoutLog["entries"]) ?? [],
    notes: r.notes,
  };
}

export async function getFitProfile(accountId: string): Promise<{ answers: FitAnswers; startedAt: Date } | null> {
  const profile = await prisma.fitProfile.findUnique({ where: { accountId } });
  if (!profile) return null;
  const parsed = answersSchema.safeParse(profile.answers);
  if (!parsed.success) return null;
  return { answers: parsed.data, startedAt: profile.startedAt };
}

export type FitContext = {
  answers: FitAnswers;
  startedAt: string;
  bios: BioRecord[];
  logs: WorkoutLog[];
  analysis: BioAnalysis;
  week: WeekPlan;
  nextWeek: WeekPlan | null;
  nutrition: NutritionPlan;
  streak: number;
  achievements: Achievement[];
  weekdays: number[];
};

/** Loads everything and derives the live plan. Redirects to onboarding
 * when the questionnaire hasn't been answered yet. */
export async function loadFitContext(): Promise<FitContext> {
  const account = await requireFitAccount();
  const profile = await getFitProfile(account.id);
  if (!profile) redirect("/fit/comecar");
  const [bioRows, logRows] = await Promise.all([
    prisma.fitBioRecord.findMany({ where: { accountId: account.id }, orderBy: { measuredAt: "asc" }, include: BIO_INCLUDE }),
    prisma.fitWorkoutLog.findMany({ where: { accountId: account.id }, orderBy: { performedAt: "desc" }, take: 300 }),
  ]);
  const bios = bioRows.map(toBio);
  const logs = logRows.map(toLog);
  const { answers, startedAt } = profile;
  const analysis = analyzeBio(answers, bios);
  const weekNo = currentWeek(startedAt, answers.programWeeks);
  const week = generateWeek(answers, analysis.adjustments, weekNo);
  const nextWeek = weekNo < week.totalWeeks ? generateWeek(answers, analysis.adjustments, weekNo + 1) : null;
  const nutrition = nutritionPlan(answers, analysis.latest, analysis.adjustments, week.goal);
  const weekdays = trainingWeekdays(answers.daysPerWeek);
  const streak = streakDays(logs, weekdays);
  return {
    answers,
    startedAt: startedAt.toISOString(),
    bios,
    logs,
    analysis,
    week,
    nextWeek,
    nutrition,
    streak,
    achievements: achievements(logs, bios, streak),
    weekdays,
  };
}
