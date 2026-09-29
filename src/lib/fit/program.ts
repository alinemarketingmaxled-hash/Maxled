import { EXERCISES, canDo, getExercise, type Exercise, type Pattern } from "./exercises";
import type { Adjustments } from "./bio";
import type { Equipment, FitAnswers, FocusLevel, Goal, Level, MobilityPref, Muscle } from "./types";
import { MACHINES, MUSCLE_LABEL } from "./types";
import { stretchesFor } from "./stretches";

export type PhaseKind = "adaptacao" | "volume" | "intensidade" | "forca" | "metabolico" | "pico";

export const PHASE_INFO: Record<PhaseKind, { label: string; description: string }> = {
  adaptacao: { label: "Adaptação", description: "Aprender os movimentos, fortalecer articulações e criar o hábito." },
  volume: { label: "Volume", description: "Mais séries por músculo para estimular crescimento." },
  intensidade: { label: "Intensidade", description: "Cargas mais altas, menos repetições, perto da falha." },
  forca: { label: "Força", description: "Poucas repetições pesadas nos exercícios básicos." },
  metabolico: { label: "Metabólico", description: "Descansos curtos, bi-sets e cardio para queimar mais." },
  pico: { label: "Pico", description: "Consolidar ganhos de força com volume reduzido." },
};

type PhaseParams = {
  compoundReps: [number, number];
  isoReps: [number, number];
  compoundRest: number;
  isoRest: number;
  rir: number;
  compoundSets: number;
  isoSets: number;
  superset: boolean;
};

const PHASE_PARAMS: Record<PhaseKind, PhaseParams> = {
  adaptacao: { compoundReps: [12, 15], isoReps: [12, 15], compoundRest: 60, isoRest: 45, rir: 3, compoundSets: 3, isoSets: 2, superset: false },
  volume: { compoundReps: [8, 12], isoReps: [12, 15], compoundRest: 90, isoRest: 60, rir: 2, compoundSets: 4, isoSets: 3, superset: false },
  intensidade: { compoundReps: [6, 8], isoReps: [10, 12], compoundRest: 120, isoRest: 75, rir: 1, compoundSets: 4, isoSets: 3, superset: false },
  forca: { compoundReps: [3, 5], isoReps: [8, 10], compoundRest: 180, isoRest: 90, rir: 2, compoundSets: 5, isoSets: 3, superset: false },
  metabolico: { compoundReps: [10, 15], isoReps: [15, 20], compoundRest: 45, isoRest: 30, rir: 2, compoundSets: 3, isoSets: 3, superset: true },
  pico: { compoundReps: [2, 4], isoReps: [8, 10], compoundRest: 180, isoRest: 90, rir: 1, compoundSets: 4, isoSets: 2, superset: false },
};

const PHASE_SEQUENCE: Record<Goal, PhaseKind[]> = {
  hipertrofia: ["volume", "intensidade", "volume", "forca", "volume", "intensidade"],
  forca: ["volume", "forca", "intensidade", "pico", "forca", "pico"],
  emagrecimento: ["metabolico", "volume", "metabolico", "intensidade", "metabolico", "volume"],
  recomposicao: ["volume", "metabolico", "intensidade", "volume", "metabolico", "intensidade"],
  condicionamento: ["metabolico", "volume", "metabolico", "intensidade", "metabolico", "metabolico"],
  saude: ["adaptacao", "volume", "adaptacao", "volume", "metabolico", "volume"],
};

const BLOCK_WEEKS = 4;

export type Block = { index: number; kind: PhaseKind; fromWeek: number; toWeek: number };

export function buildBlocks(goal: Goal, level: Level, totalWeeks: number): Block[] {
  const seq = [...PHASE_SEQUENCE[goal]];
  if (level === "iniciante" && seq[0] !== "adaptacao") seq.unshift("adaptacao");
  const blocks: Block[] = [];
  for (let w = 1, i = 0; w <= totalWeeks; w += BLOCK_WEEKS, i++) {
    blocks.push({ index: i, kind: seq[i % seq.length], fromWeek: w, toWeek: Math.min(totalWeeks, w + BLOCK_WEEKS - 1) });
  }
  return blocks;
}

type Slot = {
  pattern: Pattern;
  muscle?: Muscle;
  priority: number;
  /** Added for a focus region: tried with fallback patterns (see FOCUS_PATTERNS). */
  focus?: Muscle;
  /** Opening mobility block (answers.mobility). */
  mobility?: boolean;
};

type DayTemplate = { key: string; title: string; focus: Muscle[]; slots: Slot[] };

const s = (pattern: Pattern, priority: number, muscle?: Muscle): Slot => ({ pattern, priority, muscle });

const T: Record<string, DayTemplate> = {
  fullA: {
    key: "fullA",
    title: "Corpo inteiro A",
    focus: ["quadriceps", "peito", "costas"],
    slots: [s("agachar", 1), s("empurrar_h", 1), s("puxar_h", 1), s("dobrar_quadril", 2), s("isolado_ombro", 3, "ombros"), s("core", 2), s("isolado_braco", 4, "biceps")],
  },
  fullB: {
    key: "fullB",
    title: "Corpo inteiro B",
    focus: ["posterior", "ombros", "costas"],
    slots: [s("dobrar_quadril", 1), s("empurrar_v", 1), s("puxar_v", 1), s("unilateral_perna", 2), s("empurrar_h", 3), s("core", 2), s("isolado_braco", 4, "triceps")],
  },
  fullC: {
    key: "fullC",
    title: "Corpo inteiro C",
    focus: ["gluteos", "peito", "costas"],
    slots: [s("unilateral_perna", 1), s("empurrar_h", 1), s("puxar_v", 1), s("dobrar_quadril", 2, "gluteos"), s("puxar_h", 3), s("isolado_perna", 4, "panturrilha"), s("core", 2)],
  },
  upperA: {
    key: "upperA",
    title: "Superiores A",
    focus: ["peito", "costas", "ombros"],
    slots: [s("empurrar_h", 1), s("puxar_h", 1), s("empurrar_v", 2), s("puxar_v", 2), s("isolado_ombro", 3, "ombros"), s("isolado_braco", 3, "biceps"), s("isolado_braco", 4, "triceps")],
  },
  lowerA: {
    key: "lowerA",
    title: "Inferiores A",
    focus: ["quadriceps", "gluteos"],
    slots: [s("agachar", 1), s("dobrar_quadril", 1), s("unilateral_perna", 2), s("isolado_perna", 3, "quadriceps"), s("isolado_perna", 3, "panturrilha"), s("core", 2)],
  },
  upperB: {
    key: "upperB",
    title: "Superiores B",
    focus: ["costas", "ombros", "biceps"],
    slots: [s("puxar_v", 1), s("empurrar_v", 1), s("puxar_h", 2), s("empurrar_h", 2), s("isolado_ombro", 3, "ombros"), s("isolado_braco", 3, "triceps"), s("isolado_braco", 4, "biceps")],
  },
  lowerB: {
    key: "lowerB",
    title: "Inferiores B",
    focus: ["posterior", "gluteos"],
    slots: [s("dobrar_quadril", 1), s("unilateral_perna", 1), s("agachar", 2), s("isolado_perna", 3, "posterior"), s("isolado_perna", 3, "gluteos"), s("core", 2)],
  },
  push: {
    key: "push",
    title: "Empurrar — peito, ombro e tríceps",
    focus: ["peito", "ombros", "triceps"],
    slots: [s("empurrar_h", 1), s("empurrar_v", 1), s("empurrar_h", 2), s("isolado_ombro", 2, "ombros"), s("isolado_braco", 3, "triceps"), s("isolado_braco", 4, "triceps"), s("core", 4)],
  },
  pull: {
    key: "pull",
    title: "Puxar — costas e bíceps",
    focus: ["costas", "biceps"],
    slots: [s("puxar_v", 1), s("puxar_h", 1), s("puxar_h", 2), s("isolado_ombro", 3, "ombros"), s("isolado_braco", 2, "biceps"), s("isolado_braco", 4, "biceps"), s("core", 4)],
  },
  legs: {
    key: "legs",
    title: "Pernas completas",
    focus: ["quadriceps", "posterior", "gluteos"],
    slots: [s("agachar", 1), s("dobrar_quadril", 1), s("unilateral_perna", 2), s("isolado_perna", 3, "quadriceps"), s("isolado_perna", 3, "posterior"), s("isolado_perna", 4, "panturrilha"), s("core", 3)],
  },
  circuit: {
    key: "circuit",
    title: "Circuito metabólico",
    focus: ["cardio", "core"],
    slots: [s("condicionamento", 1), s("agachar", 1), s("empurrar_h", 1), s("puxar_h", 2), s("condicionamento", 2), s("unilateral_perna", 2), s("core", 3)],
  },
  mobility: {
    key: "mobility",
    title: "Mobilidade e core",
    focus: ["core"],
    slots: [s("mobilidade", 1), s("mobilidade", 1), s("core", 1), s("dobrar_quadril", 2), s("mobilidade", 2), s("core", 3)],
  },
};

function templatesFor(days: number, level: Level, goal: Goal, mobility: MobilityPref): DayTemplate[] {
  const metabolic = goal === "emagrecimento" || goal === "condicionamento";
  // A whole mobility day only for people who said they want mobility.
  const easyDay = mobility === "nao" ? T.circuit : T.mobility;
  switch (Math.min(6, Math.max(1, days))) {
    case 1:
      return [T.fullA];
    case 2:
      return [T.fullA, T.fullB];
    case 3:
      if (level === "iniciante" || goal === "saude" || metabolic) return [T.fullA, T.fullB, T.fullC];
      return [T.push, T.pull, T.legs];
    case 4:
      if (goal === "saude") return [T.fullA, easyDay, T.fullB, T.fullC];
      if (metabolic) return [T.upperA, T.lowerA, T.circuit, T.fullB];
      return [T.upperA, T.lowerA, T.upperB, T.lowerB];
    case 5:
      if (metabolic) return [T.upperA, T.lowerA, T.circuit, T.upperB, T.lowerB];
      if (goal === "saude") return mobility === "nao" ? [T.fullA, T.upperA, T.fullB, T.circuit, T.lowerA] : [T.fullA, T.mobility, T.fullB, T.circuit, T.fullC];
      return [T.push, T.pull, T.legs, T.upperA, T.lowerB];
    default:
      if (metabolic) return [T.push, T.pull, T.legs, T.circuit, T.upperB, T.lowerB];
      return [T.push, T.pull, T.legs, T.push, T.pull, T.legs].map((t, i) =>
        i < 3 ? t : { ...t, key: `${t.key}2`, title: `${t.title} (variação)` },
      );
  }
}

/** The user's chosen weekdays, or an even spread for their frequency. */
export function resolveWeekdays(answers: Pick<FitAnswers, "trainingDays" | "daysPerWeek">): number[] {
  const picked = [...new Set(answers.trainingDays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  return picked.length ? picked : trainingWeekdays(answers.daysPerWeek);
}

/** Weekday indices (0 = segunda) for each training day. */
export function trainingWeekdays(days: number): number[] {
  switch (Math.min(6, Math.max(1, days))) {
    case 1:
      return [2];
    case 2:
      return [0, 3];
    case 3:
      return [0, 2, 4];
    case 4:
      return [0, 1, 3, 4];
    case 5:
      return [0, 1, 2, 3, 4];
    default:
      return [0, 1, 2, 3, 4, 5];
  }
}

export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const WEEKDAY_LONG = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export type PlannedExercise = {
  exerciseId: string;
  name: string;
  muscle: Muscle;
  sets: number;
  /** Display string: "8-12" or "30-45s". */
  reps: string;
  repMin: number;
  repMax: number;
  unit: "reps" | "seg";
  restSec: number;
  rir: number;
  tempo: string;
  /** Exercises sharing a letter are done back to back (bi-set). */
  group: string | null;
  note: string | null;
  cues: string[];
  alternatives: { id: string; name: string }[];
  /** Trains one of the user's focus regions. */
  isFocus: boolean;
  /** Part of the opening mobility block. */
  isMobility: boolean;
};

export type CardioBlock = { minutes: number; title: string; description: string; exerciseId: string | null };

export type DayPlan = {
  index: number;
  key: string;
  weekday: number;
  title: string;
  focus: Muscle[];
  warmup: string[];
  /** Dynamic stretches before training (ids from lib/fit/stretches.ts). */
  stretchesBefore: string[];
  /** Static stretches after training. */
  stretchesAfter: string[];
  exercises: PlannedExercise[];
  cardio: CardioBlock | null;
  cooldown: string[];
  estMinutes: number;
  estKcal: number;
};

export type WeekPlan = {
  week: number;
  totalWeeks: number;
  block: Block;
  phase: PhaseKind;
  deload: boolean;
  goal: Goal;
  days: DayPlan[];
  notes: string[];
};

const LEVEL_MAX_DIFF: Record<Level, number> = { iniciante: 1, intermediario: 2, avancado: 3 };

/** Rich equipment usually allows better loading for strength/hypertrophy. */
function loadScore(ex: Exercise, owned: Set<Equipment>): number {
  if (ex.equipment.length === 0) return 0;
  const reqs = owned.has("academia") ? ex.equipment : ex.equipment.filter((r) => r.every((i) => owned.has(i)));
  let best = 0;
  for (const r of reqs) {
    let v = 1;
    if (r.includes("academia") || r.includes("barra") || r.some((i) => MACHINES.includes(i) && i !== "cardio_maquina")) v = 3;
    else if (r.includes("halteres") || r.includes("kettlebell")) v = 2;
    best = Math.max(best, v);
  }
  return best;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Go-to exercises coaches reach for first; boosted when available. */
const STAPLES = new Set([
  "supino_barra",
  "supino_halteres",
  "flexao",
  "agachamento_barra",
  "agachamento_goblet",
  "leg_press",
  "terra",
  "stiff_halteres",
  "hip_thrust",
  "ponte_gluteo",
  "remada_curvada_barra",
  "remada_unilateral",
  "remada_baixa",
  "puxada_frente",
  "barra_fixa",
  "remada_invertida",
  "desenvolvimento_halteres",
  "elevacao_lateral",
  "rosca_direta_halteres",
  "triceps_polia",
  "triceps_frances",
  "afundo",
  "bulgaro",
  "mesa_flexora",
  "cadeira_extensora",
  "panturrilha_pe",
  "prancha",
  "dead_bug",
  "supino_maquina",
  "peck_deck",
  "remada_articulada",
  "puxada_supinada",
  "agachamento_smith",
  "cadeira_flexora",
  "triceps_corda",
  "coice_polia",
]);

function candidatesFor(slot: Slot, answers: FitAnswers, owned: Set<Equipment>, maxDiff: number): Exercise[] {
  const limits = new Set(answers.limitations);
  const excluded = new Set(answers.excludedExercises);
  const base = EXERCISES.filter(
    (e) =>
      !excluded.has(e.id) &&
      e.pattern === slot.pattern &&
      (!slot.muscle || e.muscle === slot.muscle) &&
      canDo(e, owned) &&
      !e.avoid.some((l) => limits.has(l)),
  );
  const fit = base.filter((e) => e.difficulty <= maxDiff);
  return fit.length ? fit : base.filter((e) => e.difficulty <= maxDiff + 1);
}

function pickExercise(
  slot: Slot,
  answers: FitAnswers,
  owned: Set<Equipment>,
  usedToday: Set<string>,
  usedWeek: Map<string, number>,
  seed: string,
  goal: Goal,
): { chosen: Exercise; alternatives: Exercise[] } | null {
  const maxDiff = LEVEL_MAX_DIFF[answers.level];
  const pool = candidatesFor(slot, answers, owned, maxDiff).filter((e) => !usedToday.has(e.id));
  if (pool.length === 0) return null;
  const wantsLoad = goal === "hipertrofia" || goal === "forca" || goal === "recomposicao";
  const mobility = slot.pattern === "mobilidade";
  const usesRoller = (e: Exercise | undefined) => !!e?.equipment.some((r) => r.includes("rolo"));
  const rollerToday = [...usedToday].some((id) => usesRoller(getExercise(id)));
  const scored = pool
    .map((e) => {
      if (mobility) {
        // Mobility isn't about load or difficulty: rotate freely, and keep
        // foam rolling to one drill a session so the block stays varied.
        let score = (hash(seed + e.id) % 100) / 100 - (usedWeek.get(e.id) ?? 0) * 4;
        if (e.difficulty > maxDiff) score -= 4;
        if (rollerToday && usesRoller(e)) score -= 6;
        if (answers.favoriteExercises.includes(e.id)) score += 8;
        return { e, score };
      }
      let score = 0;
      // Anything at or under the user's level is fine; staples win ties.
      score += e.difficulty <= maxDiff ? 2 + (e.difficulty === maxDiff && maxDiff < 3 ? 1 : 0) : -4;
      if (STAPLES.has(e.id)) score += 3;
      if (answers.favoriteExercises.includes(e.id)) score += 8;
      if (slot.priority <= 2 && e.compound) score += 3;
      score += loadScore(e, owned) * (wantsLoad ? 2 : 1);
      score -= (usedWeek.get(e.id) ?? 0) * 4;
      if (answers.focusMuscles.includes(e.muscle)) score += 1;
      // Small deterministic jitter so two equal options rotate between blocks.
      score += (hash(seed + e.id) % 100) / 100;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);
  return { chosen: scored[0].e, alternatives: scored.slice(1, 4).map((x) => x.e) };
}

function range([a, b]: [number, number], shift: number): [number, number] {
  if (shift === 0) return [a, b];
  if (shift < 0) return [Math.max(3, a - 2), Math.max(5, b - 3)];
  return [a + 2, b + 3];
}

function exerciseMinutes(p: PlannedExercise): number {
  const avg = (p.repMin + p.repMax) / 2;
  const work = p.unit === "seg" ? avg : avg * 3;
  return (p.sets * (work + p.restSec)) / 60 + 0.75;
}

function cardioFor(
  answers: FitAnswers,
  goal: Goal,
  adj: Adjustments,
  owned: Set<Equipment>,
  phase: PhaseKind,
  deload: boolean,
): CardioBlock | null {
  let minutes =
    goal === "emagrecimento" ? 20 : goal === "condicionamento" ? 20 : goal === "recomposicao" ? 10 : goal === "saude" ? 10 : 0;
  if (phase === "metabolico") minutes += 5;
  if (answers.likesCardio) minutes += 5;
  if (answers.focusMuscles.includes("cardio")) minutes += answers.focusLevel === "forte" ? 10 : answers.focusLevel === "moderado" ? 5 : 0;
  minutes += adj.cardioMinutes;
  if (deload) minutes = Math.round(minutes * 0.6);
  if (minutes <= 0) return null;
  const limits = new Set(answers.limitations);
  const lowImpact = limits.has("joelho") || limits.has("gestante") || limits.has("hipertensao");
  const hiit = !lowImpact && (phase === "metabolico" || adj.density) && answers.level !== "iniciante";
  // Beyond ~20 min, straight HIIT stops paying off; split into mixed work.
  if (hiit && minutes > 20) {
    const machine = owned.has("cardio_maquina") || owned.has("academia");
    return {
      minutes,
      title: "Cardio misto",
      description: `15 min intervalado (${machine ? "30s forte / 60s leve na esteira ou bike" : "40s ativo / 20s pausa: polichinelo, skipping, shadow boxing"}) + ${minutes - 15} min em ritmo moderado contínuo`,
      exerciseId: machine ? "esteira_intervalado" : "polichinelo",
    };
  }
  if (owned.has("cardio_maquina") || owned.has("academia")) {
    return hiit
      ? { minutes, title: "HIIT na esteira/bike", description: `${Math.round(minutes / 1.5)} tiros de 30s forte + 60s leve`, exerciseId: "esteira_intervalado" }
      : { minutes, title: "Cardio contínuo", description: "Caminhada inclinada ou bike em ritmo que ainda dá para conversar (zona 2)", exerciseId: "caminhada_inclinada" };
  }
  if (owned.has("corda") && !limits.has("joelho")) {
    return { minutes, title: "Pular corda", description: hiit ? "40s pulando / 20s descanso" : "Blocos de 2 min com 30s de pausa", exerciseId: "corda" };
  }
  return hiit
    ? { minutes, title: "HIIT peso corporal", description: "Polichinelo, skipping e shadow boxing — 40s ativo / 20s pausa", exerciseId: "polichinelo" }
    : { minutes, title: "Caminhada rápida", description: "Ao ar livre ou no lugar, ritmo acelerado constante", exerciseId: null };
}

function warmupFor(answers: FitAnswers): string[] {
  const list = ["3-5 min de cardio leve (bike, esteira, polichinelo) para elevar a temperatura", "Alongamentos dinâmicos abaixo, com as fotos", "1-2 séries leves do primeiro exercício"];
  if (answers.timeOfDay === "manha") list.push("De manhã as articulações estão mais rígidas: gaste 2 min extras aquecendo");
  return list;
}

const FOCUS_EXTRA_SETS: Record<FocusLevel, number> = { leve: 1, moderado: 1, forte: 1 };

/** Patterns that train each region, best first — a focus slot falls back
 * down the list when the user lacks the equipment for the first. */
const FOCUS_PATTERNS: Record<Muscle, Pattern[]> = {
  peito: ["empurrar_h"],
  costas: ["puxar_h", "puxar_v"],
  ombros: ["isolado_ombro", "empurrar_v"],
  biceps: ["isolado_braco"],
  triceps: ["isolado_braco", "empurrar_h"],
  quadriceps: ["isolado_perna", "agachar", "unilateral_perna"],
  posterior: ["isolado_perna", "dobrar_quadril"],
  gluteos: ["dobrar_quadril", "isolado_perna", "unilateral_perna"],
  panturrilha: ["isolado_perna"],
  core: ["core"],
  cardio: ["condicionamento"],
};

const UPPER: Muscle[] = ["peito", "costas", "ombros", "biceps", "triceps"];
const LOWER: Muscle[] = ["quadriceps", "posterior", "gluteos", "panturrilha"];
/** Regions each kind of day can take extra work for. */
function dayRegions(t: DayTemplate): Muscle[] {
  const k = t.key.replace(/2$/, "");
  if (k.startsWith("full") || k === "circuit") return [...UPPER, ...LOWER];
  if (k.startsWith("upper")) return UPPER;
  if (k.startsWith("lower") || k === "legs") return LOWER;
  if (k === "push") return ["peito", "ombros", "triceps"];
  if (k === "pull") return ["costas", "biceps", "ombros"];
  return [];
}

/** Extra slots a day gets for the user's focus regions. Core, calves and
 * cardio recover fast, so they can show up every day; the rest go on the
 * days that already train that region. With many regions picked, they
 * rotate across the week so each still gets its share. */
function focusSlotsFor(t: DayTemplate, dayIndex: number, answers: FitAnswers): Slot[] {
  if (answers.focusMuscles.length === 0 || t.key === "mobility") return [];
  const level = answers.focusLevel;
  const everyDay: Muscle[] = ["core", "panturrilha", "cardio"];
  const regions = dayRegions(t);
  const eligible = answers.focusMuscles.filter((m) => everyDay.includes(m) || regions.includes(m) || t.focus.includes(m));
  if (eligible.length === 0) return [];
  const perDay = level === "forte" ? 3 : level === "moderado" ? 2 : 0;
  if (perDay === 0) return [];
  const rot = dayIndex % eligible.length;
  const ordered = [...eligible.slice(rot), ...eligible.slice(0, rot)];
  const slots: Slot[] = [];
  const perMuscle = level === "forte" ? 2 : 1;
  for (let round = 0; round < perMuscle; round++) {
    for (const m of ordered) {
      if (slots.length >= perDay) break;
      // A second exercise for the same region only on "forte" and only for
      // regions this day is built around (or core/calves).
      if (round === 1 && !t.focus.includes(m)) continue;
      slots.push({ pattern: FOCUS_PATTERNS[m][0], muscle: m === "cardio" ? undefined : m, priority: level === "forte" ? 1.5 : 2.5, focus: m });
    }
  }
  return slots;
}

/** "Prioridade máxima" trains the focus regions first, while fresh (core
 * stays at the end so it doesn't tire the stabilizers for heavy lifts). */
function orderWithFocus(base: Slot[], extra: Slot[], level: FocusLevel): Slot[] {
  if (level !== "forte") return [...base, ...extra];
  const early = extra.filter((s) => s.focus !== "core" && s.focus !== "cardio");
  const late = extra.filter((s) => s.focus === "core" || s.focus === "cardio");
  return [...early, ...base, ...late];
}

/** Joints each kind of day loads, in the order the mobility block visits
 * them (mobility drills are tagged with the region they free up). */
function mobilityRegions(t: DayTemplate): Muscle[] {
  const k = t.key.replace(/2$/, "");
  if (k.startsWith("lower") || k === "legs") return ["gluteos", "panturrilha", "posterior", "quadriceps"];
  if (k.startsWith("upper") || k === "push" || k === "pull") return ["costas", "ombros", "peito"];
  return ["gluteos", "costas", "ombros", "panturrilha"];
}

/** 2 (curta) or 3 (completa) drills for the joints the session uses. The
 * mobility day already is mobility work, so it gets none on top. */
function mobilitySlotsFor(t: DayTemplate, dayIndex: number, answers: FitAnswers): Slot[] {
  if (answers.mobility === "nao" || t.key === "mobility") return [];
  const n = answers.mobility === "completa" ? 3 : 2;
  const regions = mobilityRegions(t);
  const rot = dayIndex % regions.length;
  const ordered = [...regions.slice(rot), ...regions.slice(0, rot)];
  return ordered.slice(0, n).map((m) => ({ pattern: "mobilidade", muscle: m, priority: 2, mobility: true }));
}

function pickFocusAware(
  slot: Slot,
  answers: FitAnswers,
  owned: Set<Equipment>,
  usedToday: Set<string>,
  usedWeek: Map<string, number>,
  seed: string,
  goal: Goal,
): ReturnType<typeof pickExercise> {
  if (slot.mobility) {
    return (
      pickExercise(slot, answers, owned, usedToday, usedWeek, seed, goal) ??
      pickExercise({ ...slot, muscle: undefined }, answers, owned, usedToday, usedWeek, seed, goal)
    );
  }
  if (!slot.focus) return pickExercise(slot, answers, owned, usedToday, usedWeek, seed, goal);
  for (const pattern of FOCUS_PATTERNS[slot.focus]) {
    const pick = pickExercise({ ...slot, pattern }, answers, owned, usedToday, usedWeek, seed, goal);
    if (pick) return pick;
  }
  return null;
}

/** Stretches picked from what the session actually trains. */
function dayStretches(list: PlannedExercise[], answers: FitAnswers): { stretchesBefore: string[]; stretchesAfter: string[] } {
  const muscles = new Set<Muscle>();
  for (const p of list) {
    muscles.add(p.muscle);
    for (const m of getExercise(p.exerciseId)?.secondary ?? []) muscles.add(m);
  }
  const trained = [...muscles].filter((m) => m !== "cardio");
  return {
    stretchesBefore: stretchesFor(trained, "dinamico", answers.limitations).map((s) => s.id),
    stretchesAfter: stretchesFor(trained, "estatico", answers.limitations).map((s) => s.id),
  };
}

/** Generates one week of training. Pure and deterministic: the same inputs
 * always produce the same plan, so the server can regenerate it on every
 * request (and the session player can trust exercise IDs). */
export function generateWeek(answers: FitAnswers, adj: Adjustments, week: number): WeekPlan {
  const goal = adj.goalOverride ?? answers.goal;
  const totalWeeks = Math.max(4, answers.programWeeks);
  const blocks = buildBlocks(goal, answers.level, totalWeeks);
  const w = Math.min(Math.max(1, week), totalWeeks);
  const block = blocks.find((b) => w >= b.fromWeek && w <= b.toWeek) ?? blocks[blocks.length - 1];
  const weekInBlock = w - block.fromWeek + 1;
  const blockLen = block.toWeek - block.fromWeek + 1;
  const deload =
    adj.deload || (blockLen === BLOCK_WEEKS && weekInBlock === BLOCK_WEEKS && !(answers.level === "iniciante" && block.index === 0));
  const phase = block.kind;
  const params = PHASE_PARAMS[phase];
  const owned = new Set<Equipment>([...answers.equipment, "peso_corporal"]);
  const weekdays = resolveWeekdays(answers);
  const templates = templatesFor(weekdays.length, answers.level, goal, answers.mobility);
  const usedWeek = new Map<string, number>();
  const limits = new Set(answers.limitations);
  const notes: string[] = [];

  // Beginners progress RIR more slowly; everyone ramps within the block.
  const rirRamp = deload ? 4 : Math.max(0, params.rir + (weekInBlock === 1 ? 1 : weekInBlock >= 3 ? -1 : 0));
  const safeRir = limits.has("hipertensao") || limits.has("gestante") ? Math.max(2, rirRamp) : rirRamp;

  const days: DayPlan[] = templates.map((t, i) => {
    const usedToday = new Set<string>();
    const seed = `${t.key}|${block.index}|${answers.sex}`;
    const extra = focusSlotsFor(t, i, answers);
    const slotsAll = [...mobilitySlotsFor(t, i, answers), ...orderWithFocus(t.slots, extra, answers.focusLevel)];

    const planned: PlannedExercise[] = [];
    const plannedSlots: Slot[] = [];
    for (const slot of slotsAll) {
      const pick = pickFocusAware(slot, answers, owned, usedToday, usedWeek, seed + planned.length, goal);
      if (!pick) continue;
      plannedSlots.push(slot);
      const ex = pick.chosen;
      usedToday.add(ex.id);
      usedWeek.set(ex.id, (usedWeek.get(ex.id) ?? 0) + 1);
      const isCompound = ex.compound && slot.priority <= 2 && !["core", "condicionamento", "mobilidade"].includes(ex.pattern);
      let [lo, hi] = range(isCompound ? params.compoundReps : params.isoReps, adj.repShift);
      if (ex.pattern === "condicionamento" || ex.pattern === "mobilidade") [lo, hi] = [10, 15];
      const timed = ex.unit === "seg";
      if (timed) [lo, hi] = ex.pattern === "condicionamento" ? [30, 45] : phase === "adaptacao" ? [20, 30] : [30, 45];
      let sets = isCompound ? params.compoundSets : params.isoSets;
      if (answers.level === "iniciante") sets = Math.min(sets, 3);
      if (answers.level === "avancado" && isCompound) sets += 1;
      if (answers.focusMuscles.includes(ex.muscle) && !slot.mobility) sets += FOCUS_EXTRA_SETS[answers.focusLevel];
      sets = Math.round(sets * adj.volume);
      if (deload) sets = Math.max(1, Math.round(sets * 0.6));
      sets = Math.min(ex.muscle === "core" || ex.muscle === "panturrilha" || !isCompound ? 4 : 5, Math.max(deload ? 1 : 2, sets));
      let rest = isCompound ? params.compoundRest : params.isoRest;
      if (adj.density) rest = Math.round(rest * 0.75);
      if (ex.pattern === "mobilidade") rest = 20;
      if (slot.mobility) {
        // Warm-up quality work: short, easy, never trimmed into strength sets.
        sets = deload ? 1 : 2;
        rest = 15;
        [lo, hi] = timed ? [30, 45] : [8, 10];
      }

      const note: string[] = [];
      if (limits.has("hipertensao") && ex.compound) note.push("Não prenda a respiração: solte o ar na subida.");
      if (limits.has("lombar") && ex.pattern === "dobrar_quadril") note.push("Amplitude só até onde a coluna fica neutra.");
      if (limits.has("joelho") && (ex.pattern === "agachar" || ex.pattern === "unilateral_perna")) note.push("Amplitude confortável, sem dor no joelho.");
      if (weekInBlock === 1 && !deload && isCompound && ex.equipment.length > 0) note.push("Semana 1 do bloco: encontre a carga certa, sem ir à falha.");

      planned.push({
        exerciseId: ex.id,
        name: ex.name,
        muscle: ex.muscle,
        sets,
        reps: timed ? `${lo}-${hi}s` : `${lo}-${hi}`,
        repMin: lo,
        repMax: hi,
        unit: timed ? "seg" : "reps",
        restSec: rest,
        rir: ex.pattern === "mobilidade" ? 4 : safeRir,
        tempo: phase === "adaptacao" || deload ? "3-1-1" : phase === "forca" || phase === "pico" ? "2-1-X" : "2-0-1",
        group: null,
        note: note.join(" ") || null,
        cues: ex.cues,
        alternatives: pick.alternatives.map((a) => ({ id: a.id, name: a.name })),
        isFocus: !slot.mobility && (!!slot.focus || answers.focusMuscles.includes(ex.muscle)),
        isMobility: !!slot.mobility,
      });
    }

    // Bi-sets on metabolic phases / density: pair isolation work.
    if (params.superset || adj.density) {
      let letter = 65;
      const iso = planned.filter((p) => !p.isMobility).filter((p, idx) => idx >= 2);
      for (let k = 0; k + 1 < iso.length; k += 2) {
        const g = String.fromCharCode(letter++);
        iso[k].group = g;
        iso[k + 1].group = g;
        iso[k].restSec = Math.min(iso[k].restSec, 15);
      }
    }

    const cardio = t.key === "mobility" ? null : cardioFor(answers, goal, adj, owned, phase, deload);
    const warmup = warmupFor(answers);
    const cooldown = ["Alongamentos estáticos abaixo, segurando sem dor", "Respiração diafragmática: 1 min"];

    // Fit the session into the time the user has, in order of what hurts
    // the plan least: extra isolation work, then cardio length, then sets
    // on accessories, then more exercises, and finally the cardio itself.
    const budget = answers.sessionMinutes;
    let items = planned.map((p, idx) => ({ p, prio: plannedSlots[idx]?.priority ?? 4, idx }));
    let finalCardio = cardio;
    const minutesOf = () => 5 + 2 + (finalCardio?.minutes ?? 0) + items.reduce((acc, it) => acc + exerciseMinutes(it.p), 0);
    const dropOne = (minPrio: number, keep: number) => {
      if (items.length <= keep) return false;
      const victim = [...items].filter((it) => it.prio >= minPrio).sort((a, b) => b.prio - a.prio || b.idx - a.idx)[0];
      if (!victim) return false;
      items = items.filter((it) => it !== victim);
      return true;
    };
    while (minutesOf() > budget && dropOne(4, 4));
    if (minutesOf() > budget && finalCardio && finalCardio.minutes > 8) {
      finalCardio = { ...finalCardio, minutes: Math.max(8, finalCardio.minutes - Math.ceil(minutesOf() - budget)) };
    }
    while (minutesOf() > budget && dropOne(3, 4));
    for (const it of [...items].reverse()) {
      if (minutesOf() <= budget) break;
      if (it.p.sets > 2) it.p = { ...it.p, sets: it.p.sets - 1 };
    }
    while (minutesOf() > budget && dropOne(1, 3));
    if (minutesOf() > budget && finalCardio) finalCardio = null;
    for (const it of items) {
      if (minutesOf() <= budget) break;
      if (it.p.sets > 2) it.p = { ...it.p, sets: it.p.sets - 1 };
    }
    // Last resort for very short sessions with long strength rests.
    for (const cap of [120, 90, 60]) {
      if (minutesOf() <= budget) break;
      for (const it of items) if (it.p.restSec > cap) it.p = { ...it.p, restSec: cap };
    }
    let finalList = items.sort((a, b) => a.idx - b.idx).map((it) => it.p);
    const total = minutesOf();
    // Drop orphaned bi-set partners.
    finalList = finalList.map((p) =>
      p.group && finalList.filter((q) => q.group === p.group).length < 2 ? { ...p, group: null } : p,
    );

    const bodyKg = answers.weightKg;
    const met = phase === "metabolico" || adj.density ? 6.5 : 5;
    const estKcal = Math.round((met * 3.5 * bodyKg) / 200 * (total - (finalCardio?.minutes ?? 0)) + (finalCardio ? (8 * 3.5 * bodyKg) / 200 * finalCardio.minutes : 0));

    return {
      index: i,
      key: t.key,
      weekday: weekdays[i] ?? i,
      title: t.title,
      focus: t.focus,
      warmup,
      ...dayStretches(finalList, answers),
      exercises: finalList,
      cardio: finalCardio,
      cooldown,
      estMinutes: Math.round(total),
      estKcal,
    };
  });

  if (deload) notes.push("Semana de descarga: menos séries e mais longe da falha. É aqui que o corpo consolida os ganhos.");
  if (limits.has("gestante")) notes.push("Gestante: siga o plano apenas com liberação do seu médico e evite exercícios deitada de barriga para cima após o 1º trimestre.");
  if (limits.has("hipertensao")) notes.push("Hipertensão: mantenha a respiração fluindo e evite ir à falha. Meça a pressão antes de treinar.");
  if (answers.timeOfDay === "noite" && days.some((d) => d.cardio?.title.includes("HIIT"))) {
    notes.push("Treinando à noite: faça o HIIT até 2-3h antes de dormir para não atrapalhar o sono.");
  }
  if (answers.sleepHours < 7) notes.push(`Você dorme ${answers.sleepHours}h. Chegar a 7-9h acelera muito os resultados.`);

  return { week: w, totalWeeks, block, phase, deload, goal, days, notes };
}

export function currentWeek(startedAt: Date, totalWeeks: number, now = new Date()): number {
  const days = Math.floor((now.getTime() - startedAt.getTime()) / 86_400_000);
  return Math.min(Math.max(4, totalWeeks), Math.max(1, Math.floor(days / 7) + 1));
}

export { weekdayIndex } from "./time";

export function weeklyVolume(week: WeekPlan): { muscle: Muscle; label: string; sets: number }[] {
  const map = new Map<Muscle, number>();
  for (const day of week.days) {
    for (const p of day.exercises) {
      map.set(p.muscle, (map.get(p.muscle) ?? 0) + p.sets);
      const ex = getExercise(p.exerciseId);
      for (const m of ex?.secondary ?? []) map.set(m, (map.get(m) ?? 0) + p.sets * 0.5);
    }
  }
  return [...map.entries()]
    .filter(([m]) => m !== "cardio")
    .map(([muscle, sets]) => ({ muscle, label: MUSCLE_LABEL[muscle], sets: Math.round(sets) }))
    .sort((a, b) => b.sets - a.sets);
}
