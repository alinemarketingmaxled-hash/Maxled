/** Shared vocabulary for the Maxled Fit module (/fit). Everything here is
 * plain data so it can cross the server/client boundary untouched. */

export type Sex = "M" | "F";

export type Goal =
  | "emagrecimento"
  | "hipertrofia"
  | "recomposicao"
  | "forca"
  | "condicionamento"
  | "saude";

export type Level = "iniciante" | "intermediario" | "avancado";

export type TimeOfDay = "manha" | "tarde" | "noite";

export type ActivityLevel = "sedentario" | "leve" | "moderado" | "alto";

export type Equipment =
  | "peso_corporal"
  | "academia"
  | "halteres"
  | "barra"
  | "anilhas"
  | "banco"
  | "kettlebell"
  | "elastico"
  | "barra_fixa"
  | "paralelas"
  | "trx"
  | "bola_suica"
  | "corda"
  | "rolo"
  | "cardio_maquina"
  // Aparelhos de academia — for gyms that don't have everything (condomínio,
  // studio, home gym). "academia" still implies all of them.
  | "polia"
  | "leg_press"
  | "extensora_flexora"
  | "abdutora"
  | "smith"
  | "maquinas_peito_ombro"
  | "maquinas_costas"
  | "panturrilha_maquina";

export type FocusLevel = "leve" | "moderado" | "forte";

export const FOCUS_LEVEL_LABEL: Record<FocusLevel, { label: string; hint: string }> = {
  leve: { label: "Um pouco mais", hint: "+1 série nos exercícios dessas regiões" },
  moderado: { label: "Bem mais", hint: "Exercício extra nos dias certos e mais séries" },
  forte: { label: "Prioridade máxima", hint: "Treina essas regiões primeiro, quase todo treino, com o dobro de estímulo" },
};

/** Whether (and how much) mobility work goes into each session. */
export type MobilityPref = "nao" | "curta" | "completa";

export const MOBILITY_LABEL: Record<MobilityPref, { label: string; hint: string }> = {
  nao: { label: "Não quero", hint: "Só o alongamento de aquecimento, sem exercícios de mobilidade" },
  curta: { label: "Sim, um bloco curto", hint: "2 exercícios de mobilidade (~4 min) no começo de cada treino" },
  completa: { label: "Sim, bloco completo", hint: "3 exercícios (~7 min) em cada treino, escolhidos para as articulações do dia" },
};

export type Limitation = "joelho" | "lombar" | "ombro" | "punho" | "quadril" | "cervical" | "hipertensao" | "gestante";

export type Muscle =
  | "peito"
  | "costas"
  | "ombros"
  | "biceps"
  | "triceps"
  | "quadriceps"
  | "posterior"
  | "gluteos"
  | "panturrilha"
  | "core"
  | "cardio";

export type FitAnswers = {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  /** Where the user wants to land. Either or both may be set. */
  targetWeightKg: number | null;
  targetBodyFatPct: number | null;
  /** Length of the program in weeks (período do programa). */
  programWeeks: number;
  level: Level;
  daysPerWeek: number;
  /** Weekdays the user picked (0 = segunda). Empty = spread automatically. */
  trainingDays: number[];
  sessionMinutes: number;
  timeOfDay: TimeOfDay;
  equipment: Equipment[];
  limitations: Limitation[];
  focusMuscles: Muscle[];
  /** How hard the plan leans into the focus regions. */
  focusLevel: FocusLevel;
  /** Mobility drills at the start of each session (asked in the questionnaire). */
  mobility: MobilityPref;
  activityLevel: ActivityLevel;
  sleepHours: number;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  likesCardio: boolean;
  trainingAtHome: boolean;
  /** Exercises the user asked never to get again ("não quero este"). */
  excludedExercises: string[];
  /** Exercises the user asked to keep; they win ties in the generator. */
  favoriteExercises: string[];
};

export type BioRecord = {
  id: string;
  measuredAt: string;
  source: "manual" | "laudo" | "foto";
  weightKg: number;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  leanMassKg: number | null;
  visceralFat: number | null;
  waterPct: number | null;
  boneMassKg: number | null;
  bmrKcal: number | null;
  metabolicAge: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  notes: string | null;
  /** A print/photo of the report is attached (served by /fit/bio/[id]/imagem). */
  hasImage: boolean;
};

export type BioInput = Omit<BioRecord, "id" | "hasImage"> & {
  /** JPEG/PNG/WebP data URL of the report print, when the user keeps it. */
  image: string | null;
};

export type LoggedSet = { reps: number; loadKg: number | null; done: boolean };
export type LoggedExercise = { exerciseId: string; sets: LoggedSet[] };

export type WorkoutLog = {
  id: string;
  performedAt: string;
  weekNumber: number;
  dayIndex: number;
  title: string;
  durationMin: number | null;
  rpe: number | null;
  entries: LoggedExercise[];
  notes: string | null;
};

export const GOAL_LABEL: Record<Goal, string> = {
  emagrecimento: "Emagrecimento",
  hipertrofia: "Hipertrofia",
  recomposicao: "Recomposição corporal",
  forca: "Força",
  condicionamento: "Condicionamento",
  saude: "Saúde e mobilidade",
};

export const GOAL_HINT: Record<Goal, string> = {
  emagrecimento: "Perder gordura preservando músculo",
  hipertrofia: "Ganhar massa muscular",
  recomposicao: "Perder gordura e ganhar músculo ao mesmo tempo",
  forca: "Levantar mais peso nos básicos",
  condicionamento: "Fôlego, resistência e disposição",
  saude: "Mover-se melhor, postura e qualidade de vida",
};

export const LEVEL_LABEL: Record<Level, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const TIME_LABEL: Record<TimeOfDay, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentario: "Sedentário (trabalho sentado)",
  leve: "Leve (anda um pouco no dia)",
  moderado: "Moderado (em pé / anda bastante)",
  alto: "Alto (trabalho físico)",
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  peso_corporal: "Peso corporal",
  academia: "Academia completa",
  halteres: "Halteres",
  barra: "Barra olímpica",
  anilhas: "Anilhas",
  banco: "Banco",
  kettlebell: "Kettlebell",
  elastico: "Elásticos / mini band",
  barra_fixa: "Barra fixa",
  paralelas: "Paralelas",
  trx: "TRX / fita suspensa",
  bola_suica: "Bola suíça",
  corda: "Corda de pular",
  rolo: "Rolo de liberação (foam roller)",
  cardio_maquina: "Esteira / bike / elíptico",
  polia: "Polia / cross-over / puxador",
  leg_press: "Leg press / hack",
  extensora_flexora: "Cadeira extensora e flexora",
  abdutora: "Cadeira abdutora",
  smith: "Smith",
  maquinas_peito_ombro: "Supino máquina / voador / desenvolvimento máquina",
  maquinas_costas: "Remada e puxada articuladas",
  panturrilha_maquina: "Panturrilha em pé / sentado (máquina)",
};

/** Equipment shown in the "Aparelhos" group of the questionnaire. */
export const MACHINES: Equipment[] = [
  "polia",
  "leg_press",
  "extensora_flexora",
  "abdutora",
  "smith",
  "maquinas_peito_ombro",
  "maquinas_costas",
  "panturrilha_maquina",
  "cardio_maquina",
];

export const LIMITATION_LABEL: Record<Limitation, string> = {
  joelho: "Joelho",
  lombar: "Lombar",
  ombro: "Ombro",
  punho: "Punho",
  quadril: "Quadril",
  cervical: "Cervical",
  hipertensao: "Hipertensão",
  gestante: "Gestante",
};

export const MUSCLE_LABEL: Record<Muscle, string> = {
  peito: "Peito",
  costas: "Costas",
  ombros: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  quadriceps: "Quadríceps",
  posterior: "Posterior de coxa",
  gluteos: "Glúteos",
  panturrilha: "Panturrilha",
  core: "Abdômen / core",
  cardio: "Cardio",
};

export function ageFrom(answers: Pick<FitAnswers, "birthYear">, now = new Date()): number {
  return now.getFullYear() - answers.birthYear;
}
