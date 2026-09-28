import { fatMassKg, leanMassKg } from "./bio";
import type { BioRecord, WorkoutLog } from "./types";

export type Achievement = { id: string; title: string; detail: string; unlocked: boolean; icon: "flame" | "trophy" | "dumbbell" | "scale" | "heart" | "star" };

export function achievements(logs: WorkoutLog[], bios: BioRecord[], streak: number): Achievement[] {
  const first = bios[0];
  const last = bios.at(-1);
  const fatLost = first && last && fatMassKg(first) != null && fatMassKg(last) != null ? fatMassKg(first)! - fatMassKg(last)! : 0;
  const leanGain = first && last && leanMassKg(first) != null && leanMassKg(last) != null ? leanMassKg(last)! - leanMassKg(first)! : 0;
  const totalSets = logs.reduce((acc, l) => acc + l.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0), 0);
  const tonnage = logs.reduce(
    (acc, l) => acc + l.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).reduce((x, s) => x + s.reps * (s.loadKg ?? 0), 0), 0),
    0,
  );
  return [
    { id: "primeiro", title: "Primeiro treino", detail: "Concluiu o primeiro treino", unlocked: logs.length >= 1, icon: "star" },
    { id: "dez", title: "10 treinos", detail: "Dez treinos concluídos", unlocked: logs.length >= 10, icon: "dumbbell" },
    { id: "cinquenta", title: "50 treinos", detail: "Cinquenta treinos concluídos", unlocked: logs.length >= 50, icon: "trophy" },
    { id: "streak7", title: "Sequência de 7", detail: "7 dias seguidos cumprindo o plano", unlocked: streak >= 7, icon: "flame" },
    { id: "series500", title: "500 séries", detail: "Quinhentas séries completas", unlocked: totalSets >= 500, icon: "dumbbell" },
    { id: "tonelada", title: "10 toneladas", detail: "10.000 kg levantados no total", unlocked: tonnage >= 10000, icon: "trophy" },
    { id: "bio1", title: "Ponto de partida", detail: "Registrou a primeira bioimpedância", unlocked: bios.length >= 1, icon: "scale" },
    { id: "gordura2", title: "-2 kg de gordura", detail: "Perdeu 2 kg de gordura desde a 1ª bio", unlocked: fatLost >= 2, icon: "heart" },
    { id: "musculo1", title: "+1 kg de músculo", detail: "Ganhou 1 kg de massa magra desde a 1ª bio", unlocked: leanGain >= 1, icon: "dumbbell" },
  ];
}
