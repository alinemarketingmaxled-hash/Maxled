import type { Equipment, Limitation, Muscle } from "./types";

/** Movement pattern — the generator fills each session slot by pattern
 * first, then picks the best exercise the user can actually do. */
export type Pattern =
  | "empurrar_h" // supino, flexão
  | "empurrar_v" // desenvolvimento
  | "puxar_h" // remadas
  | "puxar_v" // barra, puxada
  | "agachar"
  | "dobrar_quadril" // terra, stiff, hip thrust
  | "unilateral_perna" // afundo, búlgaro
  | "isolado_braco"
  | "isolado_ombro"
  | "isolado_perna"
  | "core"
  | "condicionamento"
  | "mobilidade";

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  secondary: Muscle[];
  pattern: Pattern;
  /** Any one inner list satisfies the requirement (all items of it needed).
   * An empty outer list means nothing but the floor. */
  equipment: Equipment[][];
  /** 1 = iniciante, 2 = intermediário, 3 = avançado. */
  difficulty: 1 | 2 | 3;
  compound: boolean;
  /** Skipped entirely when the user reports one of these. */
  avoid: Limitation[];
  /** Reps-based or held/timed (seconds). */
  unit: "reps" | "seg";
  cues: string[];
};

type Def = [
  id: string,
  name: string,
  muscle: Muscle,
  secondary: Muscle[],
  pattern: Pattern,
  equipment: Equipment[][],
  difficulty: 1 | 2 | 3,
  compound: boolean,
  avoid: Limitation[],
  cues: string[],
  unit?: "reps" | "seg",
];

const BW: Equipment[][] = [];
const DB: Equipment[][] = [["halteres"]];
const DB_BENCH: Equipment[][] = [["halteres", "banco"]];
const BB: Equipment[][] = [["barra", "anilhas"]];
const BB_BENCH: Equipment[][] = [["barra", "anilhas", "banco"]];
const GYM: Equipment[][] = [["academia"]];
const KB: Equipment[][] = [["kettlebell"]];
const BAND: Equipment[][] = [["elastico"]];
const PULLUP: Equipment[][] = [["barra_fixa"]];

const DEFS: Def[] = [
  // ---------------- Peito ----------------
  ["flexao", "Flexão de braço", "peito", ["triceps", "ombros", "core"], "empurrar_h", BW, 1, true, ["punho"], ["Corpo em prancha, glúteo contraído", "Cotovelos a ~45° do tronco", "Peito quase encosta no chão"]],
  ["flexao_inclinada", "Flexão inclinada (mãos elevadas)", "peito", ["triceps", "ombros"], "empurrar_h", BW, 1, true, [], ["Mãos num banco, sofá ou parede", "Quanto mais alto, mais fácil", "Desça controlando 2 segundos"]],
  ["flexao_declinada", "Flexão declinada (pés elevados)", "peito", ["ombros", "triceps"], "empurrar_h", BW, 2, true, ["punho", "ombro"], ["Pés elevados, foco na parte alta do peito", "Não deixe o quadril cair"]],
  ["flexao_explosiva", "Flexão explosiva", "peito", ["triceps", "ombros"], "empurrar_h", BW, 3, true, ["punho", "ombro"], ["Desça controlado e suba com máxima velocidade", "Mãos podem sair do chão"]],
  ["flexao_diamante", "Flexão diamante", "triceps", ["peito"], "empurrar_h", BW, 2, true, ["punho"], ["Mãos juntas formando um losango", "Cotovelos rentes ao corpo"]],
  ["supino_halteres", "Supino reto com halteres", "peito", ["triceps", "ombros"], "empurrar_h", [["halteres", "banco"], ["academia"]], 1, true, [], ["Escápulas retraídas no banco", "Desça até alongar o peito", "Suba aproximando os halteres"]],
  ["supino_halteres_chao", "Supino no chão com halteres", "peito", ["triceps"], "empurrar_h", DB, 1, true, [], ["Deitado no chão, cotovelos tocam o solo", "Ótimo para quem não tem banco"]],
  ["supino_inclinado_halteres", "Supino inclinado com halteres", "peito", ["ombros", "triceps"], "empurrar_h", [["halteres", "banco"], ["academia"]], 2, true, [], ["Banco a 30°", "Foco na parte superior do peito"]],
  ["supino_barra", "Supino reto com barra", "peito", ["triceps", "ombros"], "empurrar_h", [...BB_BENCH, ...GYM], 2, true, ["ombro"], ["Pés firmes, arco leve na lombar", "Barra desce na linha do mamilo", "Use sempre alguém para ajudar em cargas altas"]],
  ["supino_maquina", "Supino na máquina", "peito", ["triceps"], "empurrar_h", GYM, 1, true, [], ["Ajuste o banco: pegadas na linha do peito", "Controle a volta"]],
  ["crucifixo_halteres", "Crucifixo com halteres", "peito", [], "empurrar_h", [["halteres", "banco"], ["academia"]], 1, false, ["ombro"], ["Cotovelos levemente flexionados", "Abra até sentir alongar, sem dor"]],
  ["crossover", "Crossover na polia", "peito", [], "empurrar_h", GYM, 1, false, [], ["Passo à frente, tronco levemente inclinado", "Junte as mãos na frente do peito"]],
  ["crucifixo_elastico", "Crucifixo com elástico", "peito", [], "empurrar_h", BAND, 1, false, [], ["Elástico preso atrás na altura do peito", "Abrace uma árvore imaginária"]],
  ["mergulho_paralelas", "Mergulho nas paralelas", "peito", ["triceps", "ombros"], "empurrar_h", [["paralelas"], ["academia"]], 3, true, ["ombro"], ["Tronco inclinado à frente para peito", "Desça até o ombro na linha do cotovelo"]],
  ["flexao_trx", "Flexão no TRX", "peito", ["core", "triceps"], "empurrar_h", [["trx"]], 2, true, ["ombro"], ["Alças na altura do quadril", "Core bem firme"]],

  // ---------------- Costas ----------------
  ["barra_fixa", "Barra fixa pronada", "costas", ["biceps"], "puxar_v", [...PULLUP, ...GYM], 3, true, ["ombro"], ["Comece com braços estendidos", "Leve o peito em direção à barra", "Desça controlando"]],
  ["barra_supinada", "Barra fixa supinada", "costas", ["biceps"], "puxar_v", [...PULLUP, ...GYM], 2, true, ["ombro"], ["Palmas para você", "Queixo passa a barra"]],
  ["barra_negativa", "Barra fixa negativa", "costas", ["biceps"], "puxar_v", [...PULLUP, ...GYM], 1, true, ["ombro"], ["Suba com ajuda de um apoio", "Desça em 4-5 segundos"]],
  ["barra_elastico", "Barra fixa assistida com elástico", "costas", ["biceps"], "puxar_v", [["barra_fixa", "elastico"]], 1, true, ["ombro"], ["Elástico no joelho ou pé", "Mesma técnica da barra"]],
  ["puxada_frente", "Puxada frontal", "costas", ["biceps"], "puxar_v", GYM, 1, true, [], ["Peito aberto, leve inclinação para trás", "Puxe até o alto do peito"]],
  ["puxada_elastico", "Puxada alta com elástico", "costas", ["biceps"], "puxar_v", BAND, 1, true, [], ["Elástico preso no alto da porta", "Cotovelos descem para os bolsos"]],
  ["remada_curvada_barra", "Remada curvada com barra", "costas", ["biceps", "posterior"], "puxar_h", [...BB, ...GYM], 2, true, ["lombar"], ["Quadril para trás, coluna neutra", "Puxe a barra até o umbigo"]],
  ["remada_unilateral", "Remada unilateral com halter", "costas", ["biceps"], "puxar_h", [...DB, ...GYM], 1, true, [], ["Mão e joelho apoiados", "Leve o cotovelo em direção ao quadril"]],
  ["remada_curvada_halteres", "Remada curvada com halteres", "costas", ["biceps"], "puxar_h", [...DB, ...GYM], 2, true, ["lombar"], ["Tronco a ~45°", "Aperte as escápulas no topo"]],
  ["remada_baixa", "Remada baixa na polia", "costas", ["biceps"], "puxar_h", GYM, 1, true, [], ["Coluna ereta", "Puxe o triângulo até o abdômen"]],
  ["remada_elastico", "Remada com elástico", "costas", ["biceps"], "puxar_h", BAND, 1, true, [], ["Sentado com pernas estendidas", "Cotovelos rentes ao corpo"]],
  ["remada_invertida", "Remada invertida", "costas", ["biceps", "core"], "puxar_h", [["trx"], ["barra_fixa"], ["academia"]], 1, true, [], ["Corpo reto como prancha", "Peito vai até as mãos", "Quanto mais em pé, mais fácil"]],
  ["remada_toalha", "Remada isométrica com toalha na porta", "costas", ["biceps"], "puxar_h", BW, 1, true, [], ["Toalha presa na maçaneta", "Incline o corpo para trás e puxe"]],
  ["superman", "Superman", "costas", ["gluteos"], "puxar_h", BW, 1, false, [], ["Deitado de bruços, eleve braços e pernas", "Segure 2 segundos no alto"]],
  ["pulldown_braco_estendido", "Pulldown com braços estendidos", "costas", [], "puxar_v", [...GYM, ...BAND], 1, false, [], ["Braços quase retos", "Leve as mãos até as coxas"]],
  ["kb_remada", "Remada com kettlebell", "costas", ["biceps"], "puxar_h", KB, 1, true, [], ["Mesma técnica da remada unilateral"]],

  // ---------------- Ombros ----------------
  ["desenvolvimento_halteres", "Desenvolvimento com halteres", "ombros", ["triceps"], "empurrar_v", [...DB, ...GYM], 1, true, ["ombro", "cervical"], ["Sentado ou em pé, abdômen firme", "Empurre até quase estender os braços"]],
  ["desenvolvimento_barra", "Desenvolvimento militar com barra", "ombros", ["triceps", "core"], "empurrar_v", [...BB, ...GYM], 2, true, ["ombro", "lombar", "cervical"], ["Em pé, glúteo contraído", "Cabeça passa para frente quando a barra sobe"]],
  ["desenvolvimento_maquina", "Desenvolvimento na máquina", "ombros", ["triceps"], "empurrar_v", GYM, 1, true, ["cervical"], ["Pegadas na linha do queixo"]],
  ["pike_pushup", "Flexão pike", "ombros", ["triceps"], "empurrar_v", BW, 2, true, ["punho", "ombro", "hipertensao"], ["Quadril alto em V invertido", "Cabeça desce à frente das mãos"]],
  ["desenvolvimento_elastico", "Desenvolvimento com elástico", "ombros", ["triceps"], "empurrar_v", BAND, 1, true, [], ["Pise no elástico", "Empurre para cima sem arquear"]],
  ["kb_press", "Press com kettlebell", "ombros", ["triceps", "core"], "empurrar_v", KB, 2, true, ["ombro"], ["Kettlebell apoiado no antebraço", "Suba girando levemente"]],
  ["elevacao_lateral", "Elevação lateral", "ombros", [], "isolado_ombro", [...DB, ...GYM], 1, false, [], ["Cotovelos levemente flexionados", "Suba até a linha do ombro"]],
  ["elevacao_lateral_elastico", "Elevação lateral com elástico", "ombros", [], "isolado_ombro", BAND, 1, false, [], ["Pise no elástico, suba até a linha do ombro"]],
  ["elevacao_frontal", "Elevação frontal", "ombros", [], "isolado_ombro", [...DB, ...GYM], 1, false, [], ["Braços retos até a altura dos olhos"]],
  ["crucifixo_inverso", "Crucifixo inverso", "ombros", ["costas"], "isolado_ombro", [...DB, ...GYM], 1, false, [], ["Tronco inclinado", "Abra os braços apertando as escápulas"]],
  ["face_pull", "Face pull", "ombros", ["costas"], "isolado_ombro", [...GYM, ...BAND], 1, false, [], ["Puxe a corda em direção ao rosto", "Cotovelos altos, gire para fora"]],
  ["y_raise", "Y-raise deitado", "ombros", ["costas"], "isolado_ombro", BW, 1, false, [], ["De bruços, braços em Y", "Polegar para cima"]],

  // ---------------- Braços ----------------
  ["rosca_direta_halteres", "Rosca direta com halteres", "biceps", [], "isolado_braco", [...DB, ...GYM], 1, false, [], ["Cotovelos parados ao lado do corpo", "Gire o punho ao subir"]],
  ["rosca_martelo", "Rosca martelo", "biceps", [], "isolado_braco", [...DB, ...GYM], 1, false, [], ["Pegada neutra", "Sem balançar o tronco"]],
  ["rosca_barra", "Rosca direta com barra", "biceps", [], "isolado_braco", [...BB, ...GYM], 1, false, ["punho"], ["Pegada na largura dos ombros"]],
  ["rosca_elastico", "Rosca com elástico", "biceps", [], "isolado_braco", BAND, 1, false, [], ["Pise no elástico", "Controle a descida"]],
  ["rosca_concentrada", "Rosca concentrada", "biceps", [], "isolado_braco", [...DB, ...GYM], 1, false, [], ["Cotovelo apoiado na coxa"]],
  ["rosca_toalha", "Rosca isométrica com toalha", "biceps", [], "isolado_braco", BW, 1, false, [], ["Pise na toalha e puxe com força", "Segure a contração"], "seg"],
  ["triceps_frances", "Tríceps francês com halter", "triceps", [], "isolado_braco", [...DB, ...GYM], 1, false, ["ombro"], ["Cotovelos apontando para cima", "Desça atrás da cabeça"]],
  ["triceps_polia", "Tríceps na polia", "triceps", [], "isolado_braco", GYM, 1, false, [], ["Cotovelos colados", "Estenda totalmente"]],
  ["triceps_banco", "Mergulho no banco", "triceps", ["peito"], "isolado_braco", BW, 1, false, ["ombro", "punho"], ["Mãos no banco/cadeira", "Desça até 90° no cotovelo"]],
  ["triceps_elastico", "Tríceps com elástico", "triceps", [], "isolado_braco", BAND, 1, false, [], ["Elástico preso no alto", "Estenda os braços para baixo"]],
  ["triceps_testa", "Tríceps testa", "triceps", [], "isolado_braco", [...DB_BENCH, ...BB_BENCH, ...GYM], 2, false, ["punho"], ["Desça até próximo da testa", "Cotovelos fixos"]],

  // ---------------- Pernas: agachar ----------------
  ["agachamento_livre", "Agachamento livre (peso corporal)", "quadriceps", ["gluteos", "core"], "agachar", BW, 1, true, [], ["Pés na largura do ombro", "Quadril para trás e para baixo", "Joelhos acompanham a ponta dos pés"]],
  ["agachamento_goblet", "Agachamento goblet", "quadriceps", ["gluteos", "core"], "agachar", [...DB, ...KB, ...GYM], 1, true, [], ["Halter/kettlebell junto ao peito", "Cotovelos entre os joelhos no fundo"]],
  ["agachamento_barra", "Agachamento com barra", "quadriceps", ["gluteos", "posterior", "core"], "agachar", [...BB, ...GYM], 2, true, ["lombar", "joelho"], ["Barra no trapézio", "Respire e trave o abdômen antes de descer", "Profundidade até coxa paralela ou abaixo"]],
  ["agachamento_frontal", "Agachamento frontal", "quadriceps", ["core"], "agachar", [...BB, ...GYM], 3, true, ["punho", "lombar"], ["Barra apoiada nos ombros", "Tronco bem ereto"]],
  ["leg_press", "Leg press 45°", "quadriceps", ["gluteos"], "agachar", GYM, 1, true, [], ["Lombar sempre apoiada", "Não trave os joelhos no topo"]],
  ["hack", "Agachamento hack", "quadriceps", ["gluteos"], "agachar", GYM, 2, true, ["joelho"], ["Costas apoiadas", "Desça controlado"]],
  ["agachamento_sumo", "Agachamento sumô", "gluteos", ["quadriceps", "posterior"], "agachar", [...DB, ...KB, ...GYM, ...BW], 1, true, [], ["Pés afastados e apontados para fora", "Tronco ereto"]],
  ["agachamento_isometrico", "Agachamento isométrico na parede", "quadriceps", [], "agachar", BW, 1, false, [], ["Costas na parede, joelhos a 90°", "Segure o tempo"], "seg"],
  ["agachamento_salto", "Agachamento com salto", "quadriceps", ["gluteos", "cardio"], "agachar", BW, 2, true, ["joelho", "gestante"], ["Aterrisse macio", "Emende direto na próxima"]],
  ["agachamento_elastico", "Agachamento com elástico", "quadriceps", ["gluteos"], "agachar", BAND, 1, true, [], ["Mini band acima dos joelhos", "Empurre os joelhos para fora"]],
  ["agachamento_caixa", "Agachamento no banco (box squat)", "quadriceps", ["gluteos"], "agachar", BW, 1, true, [], ["Sente de leve no banco e levante", "Ótimo para aprender o movimento"]],
  ["pistol_assistido", "Pistol squat assistido", "quadriceps", ["gluteos", "core"], "unilateral_perna", BW, 3, true, ["joelho"], ["Segure num apoio", "Desça em uma perna só"]],

  // ---------------- Pernas: unilateral ----------------
  ["afundo", "Afundo alternado", "quadriceps", ["gluteos"], "unilateral_perna", BW, 1, true, ["joelho"], ["Passo largo à frente", "Joelho de trás quase toca o chão"]],
  ["afundo_halteres", "Afundo com halteres", "quadriceps", ["gluteos"], "unilateral_perna", [...DB, ...GYM], 2, true, ["joelho"], ["Halteres ao lado do corpo", "Tronco ereto"]],
  ["bulgaro", "Agachamento búlgaro", "quadriceps", ["gluteos"], "unilateral_perna", BW, 2, true, ["joelho"], ["Pé de trás apoiado no banco/sofá", "Desça reto"]],
  ["bulgaro_halteres", "Búlgaro com halteres", "quadriceps", ["gluteos"], "unilateral_perna", [...DB, ...GYM], 3, true, ["joelho"], ["Mesma técnica, com carga"]],
  ["subida_banco", "Subida no banco (step-up)", "gluteos", ["quadriceps"], "unilateral_perna", BW, 1, true, [], ["Suba empurrando o calcanhar", "Desça controlado"]],
  ["afundo_reverso", "Afundo reverso", "gluteos", ["quadriceps"], "unilateral_perna", BW, 1, true, [], ["Passo para trás — mais amigável ao joelho"]],

  // ---------------- Pernas: quadril ----------------
  ["terra", "Levantamento terra", "posterior", ["gluteos", "costas", "core"], "dobrar_quadril", [...BB, ...GYM], 3, true, ["lombar", "hipertensao"], ["Barra rente à canela", "Coluna neutra do início ao fim", "Empurre o chão com os pés"]],
  ["stiff_halteres", "Stiff com halteres", "posterior", ["gluteos"], "dobrar_quadril", [...DB, ...GYM], 1, true, ["lombar"], ["Joelhos semiflexionados", "Leve o quadril para trás até alongar a posterior"]],
  ["stiff_barra", "Stiff com barra", "posterior", ["gluteos"], "dobrar_quadril", [...BB, ...GYM], 2, true, ["lombar"], ["Barra desliza pelas coxas"]],
  ["stiff_unilateral", "Stiff unilateral", "posterior", ["gluteos", "core"], "dobrar_quadril", BW, 2, true, [], ["Uma perna vai para trás como gangorra", "Quadril alinhado"]],
  ["kb_swing", "Kettlebell swing", "gluteos", ["posterior", "core", "cardio"], "dobrar_quadril", KB, 2, true, ["lombar"], ["Movimento é de quadril, não de braço", "Contraia o glúteo no topo"]],
  ["hip_thrust", "Hip thrust", "gluteos", ["posterior"], "dobrar_quadril", [["banco"], ["barra", "anilhas", "banco"], ["academia"]], 1, true, [], ["Escápulas no banco", "Suba até alinhar tronco e coxa", "Segure 1 segundo no topo"]],
  ["ponte_gluteo", "Ponte de glúteo", "gluteos", ["posterior"], "dobrar_quadril", BW, 1, false, [], ["Deitado, pés próximos ao quadril", "Suba contraindo o glúteo"]],
  ["ponte_unilateral", "Ponte de glúteo unilateral", "gluteos", ["posterior"], "dobrar_quadril", BW, 2, false, [], ["Uma perna estendida no ar"]],
  ["good_morning_elastico", "Good morning com elástico", "posterior", ["gluteos"], "dobrar_quadril", BAND, 1, true, [], ["Elástico sob os pés e atrás do pescoço", "Incline o tronco com coluna neutra"]],
  ["mesa_flexora", "Mesa flexora", "posterior", [], "isolado_perna", GYM, 1, false, [], ["Quadril colado no banco", "Controle a volta"]],
  ["cadeira_extensora", "Cadeira extensora", "quadriceps", [], "isolado_perna", GYM, 1, false, ["joelho"], ["Segure 1 segundo em cima"]],
  ["cadeira_abdutora", "Cadeira abdutora", "gluteos", [], "isolado_perna", GYM, 1, false, [], ["Tronco levemente à frente para mais glúteo"]],
  ["abducao_elastico", "Abdução com mini band", "gluteos", [], "isolado_perna", BAND, 1, false, [], ["Deitado de lado ou em pé", "Movimento controlado"]],
  ["flexora_bola", "Flexão de joelho na bola suíça", "posterior", ["gluteos", "core"], "isolado_perna", [["bola_suica"]], 2, false, [], ["Quadril elevado", "Puxe a bola com os calcanhares"]],
  ["nordica", "Flexão nórdica", "posterior", [], "isolado_perna", BW, 3, false, ["joelho"], ["Pés presos", "Desça o mais devagar possível"]],
  ["panturrilha_pe", "Elevação de panturrilha em pé", "panturrilha", [], "isolado_perna", BW, 1, false, [], ["Use um degrau para amplitude", "Pausa em cima e embaixo"]],
  ["panturrilha_unilateral", "Panturrilha unilateral com halter", "panturrilha", [], "isolado_perna", [...DB, ...GYM], 2, false, [], ["Segure num apoio", "Amplitude total"]],
  ["panturrilha_maquina", "Panturrilha na máquina", "panturrilha", [], "isolado_perna", GYM, 1, false, [], ["Joelhos estendidos"]],

  // ---------------- Core ----------------
  ["prancha", "Prancha", "core", [], "core", BW, 1, false, ["gestante"], ["Cotovelos sob os ombros", "Glúteo e abdômen contraídos", "Não deixe o quadril cair"], "seg"],
  ["prancha_lateral", "Prancha lateral", "core", [], "core", BW, 1, false, ["ombro"], ["Corpo alinhado de lado", "Quadril alto"], "seg"],
  ["dead_bug", "Dead bug", "core", [], "core", BW, 1, false, [], ["Lombar colada no chão", "Estenda braço e perna opostos"]],
  ["bird_dog", "Bird dog", "core", ["costas"], "core", BW, 1, false, [], ["Quatro apoios", "Estenda braço e perna opostos sem girar o quadril"]],
  ["abdominal_supra", "Abdominal supra", "core", [], "core", BW, 1, false, ["cervical", "gestante"], ["Mãos sem puxar o pescoço", "Suba só as escápulas"]],
  ["elevacao_pernas", "Elevação de pernas", "core", [], "core", BW, 2, false, ["lombar", "gestante"], ["Lombar colada no chão", "Desça devagar"]],
  ["elevacao_pernas_barra", "Elevação de pernas na barra", "core", [], "core", [...PULLUP, ...GYM], 3, false, ["ombro"], ["Sem balanço", "Suba os joelhos ao peito ou pernas estendidas"]],
  ["mountain_climber", "Mountain climber", "core", ["cardio"], "core", BW, 1, false, ["punho"], ["Posição de prancha alta", "Joelhos ao peito alternando rápido"]],
  ["pallof", "Pallof press", "core", [], "core", [...BAND, ...GYM], 1, false, [], ["De lado para a âncora", "Empurre à frente sem deixar girar"]],
  ["abdominal_bicicleta", "Abdominal bicicleta", "core", [], "core", BW, 1, false, ["cervical", "gestante"], ["Cotovelo vai ao joelho oposto", "Ritmo controlado"]],
  ["hollow_hold", "Hollow hold", "core", [], "core", BW, 2, false, ["lombar", "gestante"], ["Lombar no chão, pernas e braços estendidos", "Segure a posição de canoa"], "seg"],
  ["roda_abdominal", "Roda abdominal", "core", ["ombros"], "core", GYM, 3, false, ["lombar", "gestante"], ["De joelhos", "Estenda só até onde a lombar aguenta"]],
  ["farmer_walk", "Caminhada do fazendeiro", "core", ["costas", "biceps"], "core", [...DB, ...KB, ...GYM], 1, true, [], ["Carga pesada nas mãos", "Caminhe ereto por tempo ou distância"], "seg"],
  ["kb_turkish", "Turkish get-up", "core", ["ombros", "gluteos"], "core", KB, 3, true, ["ombro"], ["Olhos no kettlebell o tempo todo", "Movimento lento e fragmentado"]],

  // ---------------- Condicionamento ----------------
  ["polichinelo", "Polichinelo", "cardio", [], "condicionamento", BW, 1, false, ["gestante"], ["Ritmo constante", "Aterrisse na ponta dos pés"], "seg"],
  ["burpee", "Burpee", "cardio", ["peito", "quadriceps", "core"], "condicionamento", BW, 2, true, ["joelho", "punho", "hipertensao", "gestante"], ["Agache, prancha, flexão, salto", "Mantenha um ritmo que dê para sustentar"]],
  ["corrida_estacionaria", "Corrida estacionária (skipping)", "cardio", [], "condicionamento", BW, 1, false, ["gestante"], ["Joelhos altos", "Braços acompanham"], "seg"],
  ["corda", "Pular corda", "cardio", ["panturrilha"], "condicionamento", [["corda"]], 1, false, ["joelho", "gestante"], ["Saltos baixos", "Giro no punho"], "seg"],
  ["esteira_intervalado", "Intervalado na esteira/bike", "cardio", [], "condicionamento", [["cardio_maquina"], ["academia"]], 1, false, [], ["30s forte / 60s leve", "Ajuste a intensidade à sua respiração"], "seg"],
  ["remo_ergometro", "Remo ergômetro", "cardio", ["costas"], "condicionamento", GYM, 1, true, ["lombar"], ["Pernas, tronco, braços — e volta na ordem inversa"], "seg"],
  ["shadow_boxing", "Shadow boxing", "cardio", ["ombros", "core"], "condicionamento", BW, 1, false, [], ["Socos rápidos com giro do quadril", "Mantenha a guarda"], "seg"],
  ["kb_clean_press", "Kettlebell clean & press", "cardio", ["ombros", "gluteos"], "condicionamento", KB, 3, true, ["ombro", "lombar"], ["Clean com o quadril, press em seguida"]],
  ["thruster_halteres", "Thruster com halteres", "cardio", ["quadriceps", "ombros"], "condicionamento", [...DB, ...GYM], 2, true, ["ombro"], ["Agachamento + desenvolvimento num só movimento"]],
  ["patinador", "Salto do patinador", "cardio", ["gluteos"], "condicionamento", BW, 2, false, ["joelho", "gestante"], ["Salte de lado em uma perna", "Equilíbrio na aterrissagem"], "seg"],
  ["caminhada_inclinada", "Caminhada inclinada", "cardio", ["gluteos", "panturrilha"], "condicionamento", [["cardio_maquina"], ["academia"]], 1, false, [], ["Inclinação 8-12%", "Não segure no apoio"], "seg"],

  // ---------------- Mobilidade ----------------
  ["mob_quadril", "Mobilidade de quadril 90/90", "gluteos", [], "mobilidade", BW, 1, false, [], ["Sentado, pernas em 90°", "Gire de um lado para outro"], "seg"],
  ["mob_toracica", "Rotação torácica em quatro apoios", "costas", [], "mobilidade", BW, 1, false, [], ["Mão na nuca, gire o cotovelo para o teto"]],
  ["gato_camelo", "Gato-camelo", "costas", ["core"], "mobilidade", BW, 1, false, [], ["Arredonde e estenda a coluna devagar"]],
  ["alongamento_posterior", "Alongamento de posterior", "posterior", [], "mobilidade", BW, 1, false, [], ["Joelho estendido, incline à frente", "Respire fundo"], "seg"],
  ["deslocamento_ombro", "Deslocamento de ombro com bastão/elástico", "ombros", [], "mobilidade", BW, 1, false, [], ["Braços retos passam da frente para trás"]],
  ["agachamento_profundo", "Agachamento profundo sustentado", "quadriceps", ["gluteos"], "mobilidade", BW, 1, false, ["joelho"], ["Segure no fundo do agachamento", "Cotovelos empurram os joelhos"], "seg"],
];

export const EXERCISES: Exercise[] = DEFS.map(
  ([id, name, muscle, secondary, pattern, equipment, difficulty, compound, avoid, cues, unit]) => ({
    id,
    name,
    muscle,
    secondary,
    pattern,
    equipment,
    difficulty,
    compound,
    avoid,
    cues,
    unit: unit ?? "reps",
  }),
);

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

/** "Academia completa" covers every piece of equipment. */
export function canDo(ex: Exercise, owned: Set<Equipment>): boolean {
  if (ex.equipment.length === 0) return true;
  if (owned.has("academia")) return true;
  return ex.equipment.some((req) => req.every((item) => owned.has(item)));
}
