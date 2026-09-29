import { z } from "zod";

const goal = z.enum(["emagrecimento", "hipertrofia", "recomposicao", "forca", "condicionamento", "saude"]);
const equipment = z.enum([
  "peso_corporal",
  "academia",
  "halteres",
  "barra",
  "anilhas",
  "banco",
  "kettlebell",
  "elastico",
  "barra_fixa",
  "paralelas",
  "trx",
  "bola_suica",
  "corda",
  "cardio_maquina",
  "polia",
  "leg_press",
  "extensora_flexora",
  "abdutora",
  "smith",
  "maquinas_peito_ombro",
  "maquinas_costas",
  "panturrilha_maquina",
]);
const limitation = z.enum(["joelho", "lombar", "ombro", "punho", "quadril", "cervical", "hipertensao", "gestante"]);
const muscle = z.enum([
  "peito",
  "costas",
  "ombros",
  "biceps",
  "triceps",
  "quadriceps",
  "posterior",
  "gluteos",
  "panturrilha",
  "core",
  "cardio",
]);

const thisYear = new Date().getFullYear();

export const answersSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(60),
  sex: z.enum(["M", "F"]),
  birthYear: z.number().int().min(thisYear - 95).max(thisYear - 12),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  goal,
  targetWeightKg: z.number().min(30).max(300).nullable(),
  targetBodyFatPct: z.number().min(3).max(60).nullable(),
  programWeeks: z.number().int().min(4).max(52),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  daysPerWeek: z.number().int().min(1).max(6),
  sessionMinutes: z.number().int().min(20).max(150),
  timeOfDay: z.enum(["manha", "tarde", "noite"]),
  equipment: z.array(equipment),
  limitations: z.array(limitation),
  focusMuscles: z.array(muscle).max(11),
  focusLevel: z.enum(["leve", "moderado", "forte"]).default("moderado"),
  activityLevel: z.enum(["sedentario", "leve", "moderado", "alto"]),
  sleepHours: z.number().min(3).max(12),
  stressLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  likesCardio: z.boolean(),
  trainingAtHome: z.boolean(),
  excludedExercises: z.array(z.string().max(60)).max(200).default([]),
  favoriteExercises: z.array(z.string().max(60)).max(200).default([]),
});

const optNum = (min: number, max: number) => z.number().min(min).max(max).nullable();

export const bioSchema = z.object({
  measuredAt: z.string().min(1),
  source: z.enum(["manual", "laudo", "foto"]),
  weightKg: z.number().min(30).max(300),
  bodyFatPct: optNum(2, 70),
  muscleMassKg: optNum(5, 150),
  leanMassKg: optNum(15, 200),
  visceralFat: optNum(0, 60),
  waterPct: optNum(20, 80),
  boneMassKg: optNum(0.5, 10),
  bmrKcal: z.number().int().min(700).max(5000).nullable(),
  metabolicAge: z.number().int().min(10).max(100).nullable(),
  waistCm: optNum(40, 200),
  hipCm: optNum(50, 200),
  chestCm: optNum(50, 200),
  armCm: optNum(15, 70),
  thighCm: optNum(25, 100),
  notes: z.string().max(1000).nullable(),
  // ~1 MB of base64 at most; the client shrinks images well below this.
  image: z
    .string()
    .max(1_000_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Imagem inválida.")
    .nullable(),
});

export const workoutLogSchema = z.object({
  weekNumber: z.number().int().min(1).max(60),
  dayIndex: z.number().int().min(0).max(6),
  title: z.string().min(1).max(120),
  durationMin: z.number().int().min(1).max(400).nullable(),
  rpe: z.number().int().min(1).max(10).nullable(),
  notes: z.string().max(1000).nullable(),
  entries: z
    .array(
      z.object({
        exerciseId: z.string().min(1).max(60),
        sets: z.array(z.object({ reps: z.number().int().min(0).max(500), loadKg: z.number().min(0).max(1000).nullable(), done: z.boolean() })).max(12),
      }),
    )
    .max(20),
});
