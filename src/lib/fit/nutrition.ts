import type { Adjustments } from "./bio";
import { leanMassKg } from "./bio";
import type { BioRecord, FitAnswers, Goal } from "./types";
import { ageFrom } from "./types";

const ACTIVITY_FACTOR: Record<FitAnswers["activityLevel"], number> = {
  sedentario: 1.2,
  leve: 1.35,
  moderado: 1.5,
  alto: 1.7,
};

const GOAL_KCAL_FACTOR: Record<Goal, number> = {
  emagrecimento: 0.8,
  recomposicao: 0.9,
  hipertrofia: 1.1,
  forca: 1.05,
  condicionamento: 0.95,
  saude: 1,
};

const PROTEIN_G_PER_KG: Record<Goal, number> = {
  emagrecimento: 2.2,
  recomposicao: 2.2,
  hipertrofia: 1.9,
  forca: 1.8,
  condicionamento: 1.6,
  saude: 1.4,
};

export type NutritionPlan = {
  bmr: number;
  bmrMethod: string;
  tdee: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  waterL: number;
};

/** Katch-McArdle when the bio gives lean mass (more accurate), otherwise
 * Mifflin-St Jeor. A BMR printed on the scale report wins over both. */
export function nutritionPlan(answers: FitAnswers, latest: BioRecord | null, adj: Adjustments, goal: Goal): NutritionPlan {
  const weight = latest?.weightKg ?? answers.weightKg;
  const lean = latest ? leanMassKg(latest) : null;
  let bmr: number;
  let bmrMethod: string;
  if (latest?.bmrKcal) {
    bmr = latest.bmrKcal;
    bmrMethod = "da sua bioimpedância";
  } else if (lean != null) {
    bmr = Math.round(370 + 21.6 * lean);
    bmrMethod = "Katch-McArdle (massa magra)";
  } else {
    const age = ageFrom(answers);
    bmr = Math.round(10 * weight + 6.25 * answers.heightCm - 5 * age + (answers.sex === "M" ? 5 : -161));
    bmrMethod = "Mifflin-St Jeor";
  }
  const trainingBonus = 1 + answers.daysPerWeek * 0.025;
  const tdee = Math.round(bmr * ACTIVITY_FACTOR[answers.activityLevel] * trainingBonus);
  const kcal = Math.round((tdee * GOAL_KCAL_FACTOR[goal] + adj.kcalDelta) / 10) * 10;
  const proteinG = Math.round(weight * (PROTEIN_G_PER_KG[goal] + adj.proteinDelta));
  const fatG = Math.round(weight * (goal === "emagrecimento" ? 0.8 : 0.9));
  const carbG = Math.max(50, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const waterL = Math.round((weight * 0.035 + 0.5) * 10) / 10;
  return { bmr, bmrMethod, tdee, kcal, proteinG, fatG, carbG, waterL };
}
