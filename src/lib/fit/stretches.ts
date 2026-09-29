import type { Limitation, Muscle } from "./types";

/** Regions a stretch works: the training muscles plus the joints people
 * usually feel before/after a session. */
export type StretchRegion = Muscle | "quadril" | "lombar" | "adutores" | "punho" | "tornozelo" | "pescoco";

export type Stretch = {
  id: string;
  name: string;
  /** "dinamico": movement-based, before training (warms up without losing
   * strength). "estatico": held, after training. */
  kind: "dinamico" | "estatico";
  regions: StretchRegion[];
  /** What to do: "10x cada lado", "30s", "30s cada lado". */
  dose: string;
  seconds: number;
  cues: string[];
  /** Free Exercise DB id for the start/end photos (public domain). */
  image: string;
  avoid: Limitation[];
};

type Def = [string, string, Stretch["kind"], StretchRegion[], string, number, string[], string, Limitation[]?];

const DEFS: Def[] = [
  // ---------------- Dinâmicos (antes do treino) ----------------
  ["circulo_bracos", "Círculos com os braços", "dinamico", ["ombros", "peito"], "15x cada sentido", 40, ["Braços estendidos na altura dos ombros", "Comece com círculos pequenos e vá aumentando"], "Arm_Circles"],
  ["circulo_ombros", "Rotação de ombros", "dinamico", ["ombros", "pescoco"], "15x para trás", 30, ["Suba os ombros em direção às orelhas e gire para trás", "Movimento lento e amplo"], "Shoulder_Circles"],
  ["peito_dinamico", "Abertura dinâmica de peito", "dinamico", ["peito", "ombros"], "12x", 30, ["Braços à frente, abra para os lados até sentir o peito alongar", "Volte cruzando os braços à frente"], "Dynamic_Chest_Stretch"],
  ["costas_dinamico", "Alongamento dinâmico de costas", "dinamico", ["costas", "ombros"], "12x", 30, ["Braços cruzam à frente como num abraço", "Depois abra puxando as escápulas para trás"], "Dynamic_Back_Stretch"],
  ["cotovelos_atras", "Cotovelos para trás", "dinamico", ["peito", "biceps"], "12x", 30, ["Mãos na altura do peito, leve os cotovelos para trás", "Aperte as escápulas no fim"], "Elbows_Back"],
  ["punhos", "Rotação de punhos", "dinamico", ["punho", "biceps", "triceps"], "10x cada sentido", 20, ["Dedos entrelaçados, gire os punhos", "Importante antes de supino e flexões"], "Wrist_Circles"],
  ["gato_camelo_din", "Gato-camelo", "dinamico", ["costas", "lombar", "core"], "10x", 40, ["Em quatro apoios, arredonde a coluna olhando para o umbigo", "Depois estenda olhando para frente"], "Cat_Stretch"],
  ["circulo_quadril", "Rotação de quadril em pé", "dinamico", ["quadril", "gluteos", "lombar"], "10x cada sentido", 40, ["Mãos na cintura, desenhe círculos grandes com o quadril", "Joelhos levemente flexionados"], "Standing_Hip_Circles"],
  ["balanco_frente", "Balanço de perna para frente", "dinamico", ["posterior", "quadril"], "12x cada perna", 50, ["Segure num apoio", "Balance a perna estendida para frente e para trás, aumentando a altura"], "Front_Leg_Raises"],
  ["balanco_lateral", "Balanço de perna lateral", "dinamico", ["adutores", "gluteos", "quadril"], "12x cada perna", 50, ["De frente para um apoio", "Leve a perna de um lado para o outro na frente do corpo"], "Side_Leg_Raises"],
  ["balanco_tras", "Elevação de perna para trás", "dinamico", ["gluteos", "quadriceps"], "12x cada perna", 45, ["Tronco levemente inclinado, apoio à frente", "Leve a perna para trás contraindo o glúteo"], "Rear_Leg_Raises"],
  ["maior_alongamento", "O melhor alongamento do mundo", "dinamico", ["quadril", "posterior", "costas", "adutores"], "5x cada lado", 60, ["Passada longa, mão no chão ao lado do pé da frente", "Cotovelo desce até o tornozelo, depois gire o tronco abrindo o braço"], "Worlds_Greatest_Stretch"],
  ["groiner", "Groiner (escalador aberto)", "dinamico", ["adutores", "quadril"], "8x cada lado", 40, ["Posição de prancha alta", "Leve o pé ao lado da mão e volte"], "Groiners", ["punho"]],
  ["inchworm", "Inchworm (lagarta)", "dinamico", ["posterior", "core", "ombros"], "6x", 50, ["Em pé, desça as mãos ao chão", "Caminhe com as mãos até a prancha e volte"], "Inchworm", ["punho", "lombar"]],
  ["agachamento_sentar", "Agachamento de aquecimento", "dinamico", ["quadriceps", "gluteos", "tornozelo"], "12x", 40, ["Agachamento lento e profundo, sem carga", "Braços à frente para equilibrar"], "Sit_Squats", ["joelho"]],
  ["afundo_cruzado", "Afundo reverso cruzado", "dinamico", ["gluteos", "quadril", "lombar"], "8x cada perna", 50, ["Passo para trás cruzando atrás da perna da frente", "Sinta alongar a lateral do quadril"], "Crossover_Reverse_Lunge", ["joelho"]],
  ["circulo_joelhos", "Rotação de joelhos", "dinamico", ["quadriceps", "posterior"], "10x cada sentido", 30, ["Pés juntos, mãos nos joelhos", "Círculos pequenos e suaves"], "Knee_Circles"],
  ["circulo_tornozelos", "Rotação de tornozelos", "dinamico", ["tornozelo", "panturrilha"], "10x cada pé", 30, ["Ponta do pé no chão, gire o tornozelo", "Faça nos dois sentidos"], "Ankle_Circles"],
  ["moinho", "Moinho de vento", "dinamico", ["posterior", "costas", "core"], "10x alternando", 40, ["Pernas afastadas, braços abertos", "Leve a mão ao pé oposto girando o tronco"], "Windmills", ["lombar"]],
  ["tocar_pes", "Toque nos pés em pé", "dinamico", ["posterior", "lombar"], "10x", 30, ["Joelhos soltos, desça devagar até onde der", "Suba enrolando a coluna"], "Standing_Toe_Touches", ["lombar"]],

  // ---------------- Estáticos (depois do treino) ----------------
  ["peito_parede", "Alongamento de peito e ombro na parede", "estatico", ["peito", "ombros"], "30s cada lado", 60, ["Antebraço apoiado na parede na altura do ombro", "Gire o corpo para o lado oposto até sentir o peito"], "Chest_And_Front_Of_Shoulder_Stretch"],
  ["ombro_cruzado", "Ombro cruzado", "estatico", ["ombros", "costas"], "30s cada lado", 60, ["Braço estendido cruzando à frente do peito", "A outra mão puxa pelo cotovelo"], "Shoulder_Stretch"],
  ["triceps_cabeca", "Tríceps atrás da cabeça", "estatico", ["triceps", "ombros"], "30s cada lado", 60, ["Mão desce pelas costas", "A outra mão empurra o cotovelo para baixo"], "Triceps_Stretch"],
  ["biceps_pe", "Alongamento de bíceps", "estatico", ["biceps", "peito"], "30s", 30, ["Mãos entrelaçadas atrás do corpo", "Estenda os braços e eleve levemente"], "Standing_Biceps_Stretch"],
  ["dorsal_parede", "Dorsal na parede", "estatico", ["costas", "ombros"], "30s cada lado", 60, ["Mão apoiada na parede acima da cabeça", "Afaste o quadril até alongar a lateral das costas"], "One_Arm_Against_Wall"],
  ["postura_crianca", "Postura da criança", "estatico", ["costas", "lombar", "ombros"], "40s", 40, ["Sente nos calcanhares e estique os braços à frente", "Respire fundo e solte o peso"], "Childs_Pose"],
  ["costas_superior", "Alongamento de costas superior", "estatico", ["costas", "ombros"], "30s", 30, ["Mãos entrelaçadas à frente, empurre para longe", "Arredonde as costas separando as escápulas"], "Upper_Back_Stretch"],
  ["quadriceps_pe", "Quadríceps em pé", "estatico", ["quadriceps", "quadril"], "30s cada perna", 60, ["Segure o pé atrás, joelhos juntos", "Empurre o quadril levemente para frente"], "Quad_Stretch", ["joelho"]],
  ["flexor_quadril", "Flexor do quadril ajoelhado", "estatico", ["quadril", "quadriceps"], "30s cada lado", 60, ["Um joelho no chão, outro pé à frente", "Leve o quadril à frente sem arquear a lombar"], "Kneeling_Hip_Flexor"],
  ["posterior_sentado", "Posterior de coxa sentado", "estatico", ["posterior", "lombar"], "40s", 40, ["Pernas estendidas, incline o tronco à frente", "Coluna longa, não force"], "Seated_Floor_Hamstring_Stretch"],
  ["posterior_pe", "Posterior de coxa em pé", "estatico", ["posterior"], "30s cada perna", 60, ["Calcanhar apoiado num degrau, joelho estendido", "Incline o tronco à frente com a coluna reta"], "Hamstring_Stretch"],
  ["gluteo_deitado", "Glúteo deitado (figura 4)", "estatico", ["gluteos", "quadril", "lombar"], "30s cada lado", 60, ["Deitado, cruze o tornozelo sobre o joelho oposto", "Puxe a perna de baixo em direção ao peito"], "Lying_Glute"],
  ["gluteo_sentado", "Glúteo sentado", "estatico", ["gluteos", "quadril"], "30s cada lado", 60, ["Sentado, cruze uma perna sobre a outra", "Abrace o joelho e gire o tronco"], "Seated_Glute"],
  ["adutor_sentado", "Borboleta (adutores)", "estatico", ["adutores", "quadril"], "40s", 40, ["Sola dos pés juntas, joelhos para fora", "Incline o tronco à frente devagar"], "Adductor_Groin"],
  ["panturrilha_parede", "Panturrilha na parede", "estatico", ["panturrilha", "tornozelo"], "30s cada perna", 60, ["Mãos na parede, perna de trás estendida", "Calcanhar no chão"], "Calf_Stretch_Hands_Against_Wall"],
  ["lateral_pe", "Alongamento lateral em pé", "estatico", ["core", "costas"], "30s cada lado", 60, ["Braço acima da cabeça", "Incline o tronco para o lado oposto"], "Standing_Lateral_Stretch"],
  ["abdomen_cobra", "Alongamento de abdômen (acima da cabeça)", "estatico", ["core"], "30s", 30, ["Em pé, mãos entrelaçadas acima da cabeça", "Estique o corpo para cima e levemente para trás"], "Overhead_Stretch", ["lombar"]],
  ["joelhos_peito", "Joelhos ao peito", "estatico", ["lombar", "gluteos"], "40s", 40, ["Deitado, abrace os joelhos", "Solte a lombar no chão"], "Hug_Knees_To_Chest"],
  ["torcao_coluna", "Torção da coluna", "estatico", ["lombar", "costas", "gluteos"], "30s cada lado", 60, ["Sentado, uma perna cruzada sobre a outra", "Gire o tronco olhando para trás"], "Spinal_Stretch"],
  ["pescoco_lateral", "Pescoço lateral", "estatico", ["pescoco", "ombros"], "20s cada lado", 40, ["Incline a cabeça levando a orelha ao ombro", "A mão ajuda com leveza"], "Side_Neck_Stretch", ["cervical"]],
];

export const STRETCHES: Stretch[] = DEFS.map(([id, name, kind, regions, dose, seconds, cues, image, avoid]) => ({
  id,
  name,
  kind,
  regions,
  dose,
  seconds,
  cues,
  image,
  avoid: avoid ?? [],
}));

export const REGION_LABEL: Record<StretchRegion, string> = {
  peito: "Peito",
  costas: "Costas",
  ombros: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  quadriceps: "Quadríceps",
  posterior: "Posterior de coxa",
  gluteos: "Glúteos",
  panturrilha: "Panturrilha",
  core: "Abdômen",
  cardio: "Geral",
  quadril: "Quadril",
  lombar: "Lombar",
  adutores: "Parte interna da coxa",
  punho: "Punhos",
  tornozelo: "Tornozelos",
  pescoco: "Pescoço",
};

export function stretchImages(s: Stretch): [string, string] {
  return [`/fit/exercicios/${s.image}/0.webp`, `/fit/exercicios/${s.image}/1.webp`];
}

/** Picks the stretches for a session: the ones that hit the most of the
 * muscles trained today (plus the joints they load), skipping anything the
 * user's limitations rule out. Deterministic for a given input. */
export function stretchesFor(
  muscles: Muscle[],
  kind: Stretch["kind"],
  limitations: Limitation[],
  count = kind === "dinamico" ? 6 : 5,
): Stretch[] {
  const want = new Set<StretchRegion>(muscles);
  const lower = muscles.some((m) => ["quadriceps", "posterior", "gluteos", "panturrilha"].includes(m));
  const upper = muscles.some((m) => ["peito", "costas", "ombros", "biceps", "triceps"].includes(m));
  if (lower) ["quadril", "tornozelo", "adutores"].forEach((r) => want.add(r as StretchRegion));
  if (upper) ["ombros", "punho"].forEach((r) => want.add(r as StretchRegion));
  if (muscles.includes("core") || lower) want.add("lombar");
  const limits = new Set(limitations);
  const pool = STRETCHES.filter((s) => s.kind === kind && !s.avoid.some((l) => limits.has(l)));
  const chosen: Stretch[] = [];
  const covered = new Set<StretchRegion>();
  while (chosen.length < count) {
    let best: Stretch | null = null;
    let bestScore = 0;
    for (const s of pool) {
      if (chosen.includes(s)) continue;
      const score = s.regions.reduce((acc, r) => acc + (want.has(r) ? (covered.has(r) ? 0.3 : 1) : 0), 0);
      if (score > bestScore) {
        best = s;
        bestScore = score;
      }
    }
    if (!best) break;
    chosen.push(best);
    best.regions.forEach((r) => covered.add(r));
  }
  return chosen;
}
