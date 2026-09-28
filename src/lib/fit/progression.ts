import { getExercise } from "./exercises";
import type { PlannedExercise } from "./program";
import type { WorkoutLog } from "./types";
import { addDays, dayKey, weekdayIndex } from "./time";

export type LoadSuggestion = { loadKg: number | null; reps: number; message: string };

/** Double progression: fill the top of the rep range on every set, then
 * add load and drop back to the bottom of the range. */
export function suggestNext(planned: PlannedExercise, logsDesc: WorkoutLog[]): LoadSuggestion {
  const last = logsDesc.flatMap((l) => l.entries).find((e) => e.exerciseId === planned.exerciseId);
  const done = last?.sets.filter((s) => s.done) ?? [];
  const bodyweight = (getExercise(planned.exerciseId)?.equipment.length ?? 1) === 0;
  if (!last || done.length === 0) {
    if (bodyweight && planned.unit === "reps") {
      return { loadKg: null, reps: planned.repMin, message: `Primeira vez: faça as repetições com técnica limpa, parando ~${planned.rir} antes da falha.` };
    }
    return {
      loadKg: null,
      reps: planned.repMin,
      message:
        planned.unit === "seg"
          ? "Primeira vez: segure com boa técnica."
          : `Primeira vez: escolha uma carga que deixe ~${planned.rir} repetições na reserva.`,
    };
  }
  const topLoad = Math.max(0, ...done.map((s) => s.loadKg ?? 0));
  const hitTop = done.length >= planned.sets && done.every((s) => s.reps >= planned.repMax);
  const ex = getExercise(planned.exerciseId);
  if (bodyweight && hitTop) {
    return { loadKg: null, reps: planned.repMax, message: "Topo da faixa em todas as séries: vá para uma variação mais difícil (use o botão Trocar) ou desça mais devagar." };
  }
  const step = ex?.compound ? (ex.muscle === "quadriceps" || ex.muscle === "posterior" || ex.muscle === "gluteos" ? 5 : 2.5) : 1;
  if (planned.unit === "seg") {
    const best = Math.max(...done.map((s) => s.reps));
    return { loadKg: null, reps: hitTop ? best + 5 : best, message: hitTop ? `Mandou bem! Tente ${best + 5}s hoje.` : `Última vez: ${best}s. Tente igualar ou superar.` };
  }
  if (hitTop && topLoad > 0) {
    return { loadKg: topLoad + step, reps: planned.repMin, message: `Você bateu ${planned.repMax} reps em todas as séries. Suba para ${topLoad + step} kg.` };
  }
  if (hitTop) {
    return { loadKg: null, reps: planned.repMax + 2, message: "Bateu o topo da faixa: acrescente carga ou faça uma variação mais difícil." };
  }
  const bestReps = Math.max(...done.map((s) => s.reps));
  return {
    loadKg: topLoad || null,
    reps: Math.min(planned.repMax, bestReps + 1),
    message: topLoad ? `Mantenha ${topLoad} kg e busque +1 repetição por série.` : "Busque +1 repetição por série.",
  };
}

/** Estimated 1RM (Epley). */
export function oneRepMax(loadKg: number, reps: number): number {
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10;
}

export function streakDays(logsDesc: WorkoutLog[], trainingWeekdays: number[], now = new Date()): number {
  // Counts completed workouts walking back day by day; rest days don't break
  // the streak, a missed scheduled day does (today only counts once done).
  const doneDays = new Set(logsDesc.map((l) => dayKey(l.performedAt)));
  let streak = 0;
  let key = dayKey(now);
  let wd = weekdayIndex(now);
  for (let i = 0; i < 400; i++) {
    if (doneDays.has(key)) streak++;
    else if (trainingWeekdays.includes(wd) && i > 0) break;
    key = addDays(key, -1);
    wd = (wd + 6) % 7;
  }
  return streak;
}
