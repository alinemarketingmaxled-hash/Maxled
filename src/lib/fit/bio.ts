import type { BioRecord, FitAnswers, Goal } from "./types";

/** Fat mass / lean mass derived from whatever the scale reported. */
export function fatMassKg(r: BioRecord): number | null {
  if (r.bodyFatPct == null) return null;
  return round1((r.weightKg * r.bodyFatPct) / 100);
}

export function leanMassKg(r: BioRecord): number | null {
  if (r.leanMassKg != null) return r.leanMassKg;
  const fat = fatMassKg(r);
  return fat == null ? null : round1(r.weightKg - fat);
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

export function bmiLabel(v: number): string {
  if (v < 18.5) return "Abaixo do peso";
  if (v < 25) return "Peso adequado";
  if (v < 30) return "Sobrepeso";
  if (v < 35) return "Obesidade grau I";
  if (v < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

/** ACE-style body-fat bands. */
export function bodyFatBand(pct: number, sex: FitAnswers["sex"]): { label: string; tone: "good" | "ok" | "warn" | "bad" } {
  const t = sex === "M" ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (pct < t[0]) return { label: "Essencial", tone: "warn" };
  if (pct < t[1]) return { label: "Atleta", tone: "good" };
  if (pct < t[2]) return { label: "Fitness", tone: "good" };
  if (pct < t[3]) return { label: "Média", tone: "ok" };
  return { label: "Acima do ideal", tone: "bad" };
}

export function waistHipRatio(r: BioRecord): number | null {
  if (!r.waistCm || !r.hipCm) return null;
  return Math.round((r.waistCm / r.hipCm) * 100) / 100;
}

/** Sensible default target when the user left it blank on the questionnaire. */
export function defaultTargetBodyFat(answers: FitAnswers): number | null {
  const male = answers.sex === "M";
  switch (answers.goal) {
    case "emagrecimento":
    case "recomposicao":
      return male ? 15 : 23;
    case "hipertrofia":
      return male ? 14 : 22;
    default:
      return null;
  }
}

export type Trend =
  | "perdendo_gordura_mantendo_musculo"
  | "perdendo_gordura_e_musculo"
  | "ganhando_musculo_limpo"
  | "ganhando_gordura"
  | "recomposicao"
  | "estagnado"
  | "perdendo_musculo"
  | "sem_dados";

export const TREND_LABEL: Record<Trend, string> = {
  perdendo_gordura_mantendo_musculo: "Perdendo gordura e preservando músculo",
  perdendo_gordura_e_musculo: "Perdendo gordura, mas também músculo",
  ganhando_musculo_limpo: "Ganhando músculo com pouca gordura",
  ganhando_gordura: "Ganhando mais gordura que músculo",
  recomposicao: "Recomposição: menos gordura, mais músculo",
  estagnado: "Estagnado desde a última bio",
  perdendo_musculo: "Perdendo massa muscular",
  sem_dados: "Aguardando a segunda bioimpedância",
};

export type BioDelta = {
  days: number;
  weightKg: number;
  fatKg: number | null;
  leanKg: number | null;
  bodyFatPct: number | null;
  waistCm: number | null;
};

export function delta(prev: BioRecord, curr: BioRecord): BioDelta {
  const pf = fatMassKg(prev);
  const cf = fatMassKg(curr);
  const pl = leanMassKg(prev);
  const cl = leanMassKg(curr);
  return {
    days: Math.max(1, Math.round((new Date(curr.measuredAt).getTime() - new Date(prev.measuredAt).getTime()) / 86_400_000)),
    weightKg: round1(curr.weightKg - prev.weightKg),
    fatKg: pf != null && cf != null ? round1(cf - pf) : null,
    leanKg: pl != null && cl != null ? round1(cl - pl) : null,
    bodyFatPct: prev.bodyFatPct != null && curr.bodyFatPct != null ? round1(curr.bodyFatPct - prev.bodyFatPct) : null,
    waistCm: prev.waistCm != null && curr.waistCm != null ? round1(curr.waistCm - prev.waistCm) : null,
  };
}

export function classifyTrend(d: BioDelta | null): Trend {
  if (!d) return "sem_dados";
  // Scale noise: changes under these thresholds are treated as flat.
  const FAT = 0.4;
  const LEAN = 0.3;
  const fat = d.fatKg;
  const lean = d.leanKg;
  if (fat == null || lean == null) {
    if (Math.abs(d.weightKg) < 0.5) return "estagnado";
    return "sem_dados";
  }
  const fatDown = fat <= -FAT;
  const fatUp = fat >= FAT;
  const leanDown = lean <= -LEAN;
  const leanUp = lean >= LEAN;
  if (fatDown && leanUp) return "recomposicao";
  if (fatDown && leanDown) return "perdendo_gordura_e_musculo";
  if (fatDown) return "perdendo_gordura_mantendo_musculo";
  if (leanUp && fatUp) return fat > lean ? "ganhando_gordura" : "ganhando_musculo_limpo";
  if (leanUp) return "ganhando_musculo_limpo";
  if (fatUp) return "ganhando_gordura";
  if (leanDown) return "perdendo_musculo";
  return "estagnado";
}

export type GoalProgress = {
  /** 0..100 share of the way from the first bio to the target. */
  pct: number;
  metric: "gordura" | "peso" | "massa_magra";
  start: number;
  current: number;
  target: number;
  reached: boolean;
  /** Projected date to hit the target at the current pace, if moving toward it. */
  etaDate: string | null;
};

/** How far the user has come from their first bio toward their final goal. */
export function goalProgress(answers: FitAnswers, records: BioRecord[]): GoalProgress | null {
  if (records.length === 0) return null;
  const first = records[0];
  const last = records[records.length - 1];

  const targetBf = answers.targetBodyFatPct ?? defaultTargetBodyFat(answers);
  let metric: GoalProgress["metric"];
  let start: number;
  let current: number;
  let target: number;

  if (targetBf != null && first.bodyFatPct != null && last.bodyFatPct != null && answers.goal !== "hipertrofia") {
    metric = "gordura";
    start = first.bodyFatPct;
    current = last.bodyFatPct;
    target = targetBf;
  } else if (answers.targetWeightKg != null) {
    metric = "peso";
    start = first.weightKg;
    current = last.weightKg;
    target = answers.targetWeightKg;
  } else if (answers.goal === "hipertrofia" && leanMassKg(first) != null && leanMassKg(last) != null) {
    metric = "massa_magra";
    start = leanMassKg(first)!;
    current = leanMassKg(last)!;
    // ~0.25 kg de massa magra/semana é um ritmo realista de hipertrofia
    target = round1(start + answers.programWeeks * (answers.level === "iniciante" ? 0.3 : 0.18));
  } else {
    return null;
  }

  const total = target - start;
  const done = current - start;
  const reached = total === 0 ? true : total > 0 ? current >= target : current <= target;
  const pct = total === 0 ? 100 : clamp(Math.round((done / total) * 100), 0, 100);

  let etaDate: string | null = null;
  if (!reached && records.length >= 2) {
    const days = (new Date(last.measuredAt).getTime() - new Date(first.measuredAt).getTime()) / 86_400_000;
    const perDay = days > 0 ? done / days : 0;
    if (perDay !== 0 && Math.sign(perDay) === Math.sign(total)) {
      const remainingDays = (target - current) / perDay;
      if (remainingDays > 0 && remainingDays < 3 * 365) {
        etaDate = new Date(new Date(last.measuredAt).getTime() + remainingDays * 86_400_000).toISOString();
      }
    }
  }

  return { pct, metric, start: round1(start), current: round1(current), target: round1(target), reached, etaDate };
}

/** Knobs the program generator reads. Everything defaults to neutral (1 / 0). */
export type Adjustments = {
  /** Multiplies weekly set volume. */
  volume: number;
  /** Extra cardio minutes per session. */
  cardioMinutes: number;
  /** Shifts rep ranges: -1 heavier/lower reps, +1 lighter/higher reps. */
  repShift: -1 | 0 | 1;
  /** Shorter rest (metabolic density) when true. */
  density: boolean;
  /** Replaces the goal the generator programs for (e.g. goal reached → manutenção). */
  goalOverride: Goal | null;
  /** Deload the current week. */
  deload: boolean;
  /** Calorie adjustment on top of the base plan. */
  kcalDelta: number;
  /** Protein bump in g/kg. */
  proteinDelta: number;
  /** Human-readable changelog: why the plan looks the way it does. */
  reasons: { title: string; detail: string; tone: "good" | "info" | "warn" }[];
};

export const NEUTRAL: Adjustments = {
  volume: 1,
  cardioMinutes: 0,
  repShift: 0,
  density: false,
  goalOverride: null,
  deload: false,
  kcalDelta: 0,
  proteinDelta: 0,
  reasons: [],
};

export type BioAnalysis = {
  latest: BioRecord | null;
  previous: BioRecord | null;
  delta: BioDelta | null;
  trend: Trend;
  progress: GoalProgress | null;
  adjustments: Adjustments;
};

/** Core of the "bio muda o treino" feature: compares the latest bio with
 * the previous one and with the final goal, and decides how the program
 * should change. Pure function — the program is regenerated from it on
 * every render, so adding a bio immediately reshapes the plan. */
export function analyzeBio(answers: FitAnswers, recordsAsc: BioRecord[]): BioAnalysis {
  const latest = recordsAsc.at(-1) ?? null;
  const previous = recordsAsc.length >= 2 ? recordsAsc[recordsAsc.length - 2] : null;
  const d = latest && previous ? delta(previous, latest) : null;
  const trend = classifyTrend(d);
  const progress = goalProgress(answers, recordsAsc);
  const adj: Adjustments = { ...NEUTRAL, reasons: [] };
  const goal = answers.goal;
  const cutting = goal === "emagrecimento" || goal === "recomposicao";
  const bulking = goal === "hipertrofia" || goal === "forca";

  if (!latest) {
    adj.reasons.push({
      title: "Programa base",
      detail: "Adicione sua primeira bioimpedância para o treino começar a se ajustar ao seu corpo.",
      tone: "info",
    });
    return { latest, previous, delta: d, trend, progress, adjustments: adj };
  }

  // --- Starting point from a single bio -----------------------------------
  const band = latest.bodyFatPct != null ? bodyFatBand(latest.bodyFatPct, answers.sex) : null;
  if (band?.tone === "bad" && goal !== "emagrecimento") {
    adj.cardioMinutes += 10;
    adj.reasons.push({
      title: "+10 min de cardio",
      detail: `Seu percentual de gordura (${latest.bodyFatPct}%) está acima do ideal — incluí cardio leve no fim das sessões para melhorar a saúde metabólica.`,
      tone: "info",
    });
  }
  if (latest.visceralFat != null && latest.visceralFat >= 10) {
    adj.cardioMinutes += 10;
    adj.density = true;
    adj.reasons.push({
      title: "Gordura visceral alta",
      detail: `Nível ${latest.visceralFat} de gordura visceral. Descansos mais curtos e cardio extra são as ferramentas mais eficazes para reduzir.`,
      tone: "warn",
    });
  }
  if (latest.waterPct != null && latest.waterPct < (answers.sex === "M" ? 50 : 45)) {
    adj.reasons.push({
      title: "Hidratação baixa",
      detail: `Água corporal em ${latest.waterPct}%. Aumente a ingestão de água — isso também afeta a leitura da balança.`,
      tone: "warn",
    });
  }

  // --- Goal reached ---------------------------------------------------------
  if (progress?.reached) {
    if (cutting) {
      adj.goalOverride = "hipertrofia";
      adj.reasons.push({
        title: "Meta alcançada! Nova fase: construção",
        detail: "Você chegou no seu objetivo de gordura. O programa mudou para hipertrofia com leve superávit para ganhar músculo sem perder o que conquistou.",
        tone: "good",
      });
    } else {
      adj.goalOverride = "recomposicao";
      adj.reasons.push({
        title: "Meta alcançada! Nova fase: definição",
        detail: "Você bateu sua meta. O programa mudou para recomposição para revelar o músculo ganho. Atualize sua meta em Perfil quando quiser.",
        tone: "good",
      });
    }
  }

  // --- Change since last bio -------------------------------------------------
  switch (trend) {
    case "perdendo_gordura_e_musculo":
      adj.volume *= 1.15;
      adj.repShift = -1;
      adj.cardioMinutes = Math.max(0, adj.cardioMinutes - 10);
      adj.kcalDelta += 150;
      adj.proteinDelta += 0.3;
      adj.reasons.push({
        title: "Protegendo sua massa muscular",
        detail: `Você perdeu ${Math.abs(d!.leanKg!)} kg de massa magra. Aumentei o volume de musculação (+15%), cargas mais pesadas, menos cardio, +150 kcal e mais proteína.`,
        tone: "warn",
      });
      break;
    case "perdendo_musculo":
      adj.volume *= 1.2;
      adj.repShift = -1;
      adj.proteinDelta += 0.4;
      adj.kcalDelta += 200;
      adj.reasons.push({
        title: "Perda de massa muscular",
        detail: "Aumentei o volume em 20% com foco nos exercícios compostos. Revise sono, proteína e calorias — são as causas mais comuns.",
        tone: "warn",
      });
      break;
    case "ganhando_gordura":
      if (bulking) {
        adj.kcalDelta -= 200;
        adj.cardioMinutes += 10;
        adj.reasons.push({
          title: "Superávit alto demais",
          detail: `Você ganhou mais gordura (${d!.fatKg} kg) do que músculo. Reduzi 200 kcal e adicionei 10 min de cardio para um ganho mais limpo.`,
          tone: "warn",
        });
      } else {
        adj.cardioMinutes += 15;
        adj.density = true;
        adj.kcalDelta -= 250;
        adj.reasons.push({
          title: "Gordura subiu — treino mais intenso",
          detail: `+${d!.fatKg} kg de gordura. Mais 15 min de cardio, descansos mais curtos e -250 kcal no plano.`,
          tone: "warn",
        });
      }
      break;
    case "estagnado":
      if (cutting) {
        adj.cardioMinutes += 10;
        adj.density = true;
        adj.kcalDelta -= 150;
        adj.reasons.push({
          title: "Quebrando o platô",
          detail: "Sem mudança relevante desde a última bio. Adicionei intervalados, reduzi descanso e ajustei -150 kcal.",
          tone: "info",
        });
      } else {
        adj.volume *= 1.1;
        adj.repShift = adj.repShift === 0 ? -1 : adj.repShift;
        adj.kcalDelta += 150;
        adj.reasons.push({
          title: "Novo estímulo",
          detail: "Composição estável. Subi o volume em 10%, mudei a faixa de repetições e +150 kcal para voltar a progredir.",
          tone: "info",
        });
      }
      break;
    case "recomposicao":
      adj.reasons.push({
        title: "Recomposição em andamento",
        detail: `-${Math.abs(d!.fatKg!)} kg de gordura e +${d!.leanKg} kg de músculo. Mantive a estrutura e apenas progredi as cargas.`,
        tone: "good",
      });
      break;
    case "perdendo_gordura_mantendo_musculo":
      adj.reasons.push({
        title: "Emagrecimento de qualidade",
        detail: `-${Math.abs(d!.fatKg!)} kg de gordura sem perder músculo. O plano segue igual — está funcionando.`,
        tone: "good",
      });
      break;
    case "ganhando_musculo_limpo":
      adj.reasons.push({
        title: "Ganho de massa limpo",
        detail: `+${d!.leanKg} kg de massa magra com pouca gordura. Continue progredindo as cargas.`,
        tone: "good",
      });
      break;
    case "sem_dados":
      if (!previous) {
        adj.reasons.push({
          title: "Ponto de partida registrado",
          detail: "Na próxima bioimpedância (ideal a cada 3-4 semanas) o treino será recalibrado com base na sua evolução.",
          tone: "info",
        });
      }
      break;
  }

  // Pace check: moving too fast on a cut costs muscle.
  if (d && cutting && d.days >= 7) {
    const weeklyLossPct = (-d.weightKg / previous!.weightKg / d.days) * 7 * 100;
    if (weeklyLossPct > 1.2) {
      adj.kcalDelta += 150;
      adj.reasons.push({
        title: "Ritmo rápido demais",
        detail: `Você está perdendo ${weeklyLossPct.toFixed(1)}% do peso por semana. Acima de ~1% aumenta a perda de músculo, então somei +150 kcal.`,
        tone: "warn",
      });
    }
  }

  // Recovery signals from the questionnaire.
  if (answers.sleepHours < 6 || answers.stressLevel >= 5) {
    adj.volume *= 0.9;
    adj.reasons.push({
      title: "Recuperação limitada",
      detail: "Sono curto ou estresse alto: reduzi o volume em 10% para você render mais em cada série.",
      tone: "info",
    });
  }

  adj.volume = Math.round(adj.volume * 100) / 100;
  adj.cardioMinutes = clamp(adj.cardioMinutes, 0, 30);
  return { latest, previous, delta: d, trend, progress, adjustments: adj };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
