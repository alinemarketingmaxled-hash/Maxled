"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAnswersAction } from "@/app/fit/actions";
import {
  ACTIVITY_LABEL,
  EQUIPMENT_LABEL,
  GOAL_HINT,
  GOAL_LABEL,
  LEVEL_LABEL,
  LIMITATION_LABEL,
  MACHINES,
  MUSCLE_LABEL,
  TIME_LABEL,
  type Equipment,
  type FitAnswers,
  type FocusLevel,
  FOCUS_LEVEL_LABEL,
  type Goal,
  type Level,
  type Limitation,
  type Muscle,
} from "@/lib/fit/types";
import { ArrowLeftI, ArrowRightI, CheckI, DumbbellI, FlameI, HeartI, BoltI, TargetI, TrophyI } from "./FitIcons";
import { ProgressBar } from "./ui";
import { WEEKDAY_SHORT, trainingWeekdays } from "@/lib/fit/program";

const thisYear = new Date().getFullYear();

const DEFAULTS: FitAnswers = {
  name: "",
  sex: "M",
  birthYear: thisYear - 30,
  heightCm: 170,
  weightKg: 75,
  goal: "recomposicao",
  targetWeightKg: null,
  targetBodyFatPct: null,
  programWeeks: 12,
  level: "iniciante",
  daysPerWeek: 3,
  sessionMinutes: 60,
  timeOfDay: "noite",
  equipment: [],
  limitations: [],
  focusMuscles: [],
  activityLevel: "leve",
  sleepHours: 7,
  stressLevel: 3,
  likesCardio: true,
  trainingAtHome: false,
  excludedExercises: [],
  favoriteExercises: [],
  focusLevel: "moderado",
  trainingDays: [0, 2, 4],
};

const GOAL_ICON: Record<Goal, typeof FlameI> = {
  emagrecimento: FlameI,
  hipertrofia: DumbbellI,
  recomposicao: TargetI,
  forca: TrophyI,
  condicionamento: BoltI,
  saude: HeartI,
};

const LEVEL_HINT: Record<Level, string> = {
  iniciante: "Nunca treinei ou parei há mais de 6 meses",
  intermediario: "Treino há 6 meses a 2 anos com regularidade",
  avancado: "Mais de 2 anos treinando sério",
};

const PLACES: { key: string; label: string; hint: string; equipment: Equipment[]; home: boolean }[] = [
  { key: "academia", label: "Academia completa", hint: "Todos os aparelhos, barras e halteres", equipment: ["academia"], home: false },
  { key: "predio", label: "Academia do prédio / estúdio", hint: "Alguns aparelhos: marque abaixo", equipment: ["halteres", "banco", "polia", "cardio_maquina"], home: true },
  { key: "casa_equip", label: "Casa com equipamentos", hint: "Escolha abaixo o que você tem", equipment: ["halteres", "elastico"], home: true },
  { key: "casa_zero", label: "Casa sem nada", hint: "Só o peso do corpo", equipment: ["peso_corporal"], home: true },
  { key: "ar_livre", label: "Ao ar livre / praça", hint: "Barras e paralelas de praça", equipment: ["barra_fixa", "paralelas"], home: false },
];

const STEP_TITLES = [
  "Bem-vindo",
  "Sobre você",
  "Seu corpo",
  "Objetivo",
  "Meta e período",
  "Experiência",
  "Rotina de treino",
  "Equipamentos",
  "Limitações",
  "Foco",
  "Estilo de vida",
  "Resumo",
];

export function OnboardingWizard({
  initial,
  editing: editingProp,
  defaultName,
  startAtFocus = false,
}: {
  initial: FitAnswers | null;
  editing: boolean;
  defaultName: string;
  startAtFocus?: boolean;
}) {
  // Frozen at mount: saving revalidates the page, which would otherwise flip
  // a first-time run into "editing" mode mid-celebration.
  const [editing] = useState(editingProp);
  const router = useRouter();
  const [a, setA] = useState<FitAnswers>(() =>
    initial
      ? { ...initial, trainingDays: initial.trainingDays.length ? initial.trainingDays : trainingWeekdays(initial.daysPerWeek) }
      : { ...DEFAULTS, name: defaultName.split(" ")[0] ?? "" },
  );
  const [step, setStep] = useState(startAtFocus ? 9 : editing ? 1 : 0);
  const [restart, setRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const set = <K extends keyof FitAnswers>(k: K, v: FitAnswers[K]) => setA((prev) => ({ ...prev, [k]: v }));
  const toggle = <T extends string>(list: T[], v: T, max?: number): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : max && list.length >= max ? [...list.slice(1), v] : [...list, v];

  const last = STEP_TITLES.length - 1;
  const canNext = (step !== 1 || a.name.trim().length > 0) && (step !== 6 || a.trainingDays.length > 0);

  function next() {
    setError(null);
    if (step < last) setStep(step + 1);
  }

  function submit() {
    setError(null);
    start(async () => {
      const payload = { ...a, equipment: a.equipment.length ? a.equipment : (["peso_corporal"] as Equipment[]) };
      const res = await saveAnswersAction(payload, restart || !editing);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur">
        <div className="fit-pop w-full max-w-sm rounded-[36px] bg-fit-lime p-7 text-center text-fit-on-lime">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-black/10">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-fit-strong text-[#d6f94b]">
              <CheckI className="h-10 w-10" strokeWidth={3} />
            </div>
          </div>
          <h2 className="mt-5 text-2xl font-bold">{editing ? "Treino atualizado!" : "Parabéns!"}</h2>
          <p className="mt-2 text-sm opacity-80">
            {editing
              ? "Seu programa foi recalculado com as novas respostas."
              : "Seu programa está pronto. Registre sua primeira bioimpedância para o treino se ajustar ao seu corpo."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {!editing && (
              <button
                type="button"
                onClick={() => router.push("/fit/bio/nova?modo=laudo&primeira=1")}
                className="h-12 rounded-full bg-fit-strong font-semibold text-[#d6f94b]"
              >
                Adicionar minha bio agora
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                router.push("/fit");
                router.refresh();
              }}
              className={`h-12 rounded-full font-semibold ${editing ? "bg-fit-strong text-[#d6f94b]" : "bg-black/10"}`}
            >
              {editing ? "Ver meu treino" : "Depois, ver meu treino"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-fit-lime text-fit-on-lime">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between p-6">
          <div className="pt-10">
            <div className="flex gap-2">
              <span className="h-16 w-16 rounded-full bg-fit-strong" />
              <span className="h-16 w-32 rounded-t-full bg-black/15" />
            </div>
            <div className="mt-2 flex gap-2">
              <span className="h-16 w-32 rounded-b-full bg-fit-strong" />
              <span className="grid h-16 w-16 place-items-center rounded-full bg-black/15">
                <DumbbellI className="h-7 w-7" />
              </span>
            </div>
            <h1 className="mt-10 text-4xl font-bold leading-tight tracking-tight">
              Seu treino,
              <br />
              do seu jeito.
            </h1>
            <p className="mt-3 max-w-xs text-sm opacity-75">
              Algumas perguntas rápidas sobre seu objetivo, sua rotina e o que você tem para treinar. Depois, cada nova bioimpedância recalibra o plano.
            </p>
          </div>
          <div className="pb-6">
            <button type="button" onClick={next} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-fit-strong text-base font-semibold text-[#d6f94b]">
              Vamos começar <ArrowRightI className="h-5 w-5" />
            </button>
            <p className="mt-3 text-center text-[11px] opacity-60">Leva cerca de 2 minutos.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step > (editing ? 1 : 0) ? setStep(step - 1) : router.push("/fit/perfil"))}
          aria-label="Voltar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fit-strong text-white"
        >
          <ArrowLeftI className="h-4 w-4" />
        </button>
        <ProgressBar pct={(step / last) * 100} />
        <span className="shrink-0 text-xs tabular-nums text-fit-muted">
          {step}/{last}
        </span>
      </div>

      <p className="mt-6 text-xs font-medium uppercase tracking-widest text-fit-accent">{STEP_TITLES[step]}</p>

      <div key={step} className="fit-rise mt-2 flex-1">
        {step === 1 && (
          <Q title="Como podemos te chamar?">
            <input
              autoFocus
              value={a.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Seu nome"
              className="h-14 w-full rounded-2xl bg-fit-card px-4 text-lg outline-none ring-fit-lime focus:ring-2"
            />
            <Label>Sexo biológico (usado nos cálculos de gordura e metabolismo)</Label>
            <Options
              value={a.sex}
              onChange={(v) => set("sex", v)}
              options={[
                { value: "M", label: "Masculino" },
                { value: "F", label: "Feminino" },
              ]}
              cols={2}
            />
          </Q>
        )}

        {step === 2 && (
          <Q title="Suas medidas de hoje">
            <Stepper label="Ano de nascimento" value={a.birthYear} min={thisYear - 95} max={thisYear - 12} step={1} onChange={(v) => set("birthYear", v)} suffix={`${thisYear - a.birthYear} anos`} />
            <Stepper label="Altura" value={a.heightCm} min={120} max={230} step={1} unit="cm" onChange={(v) => set("heightCm", v)} />
            <Stepper label="Peso" value={a.weightKg} min={30} max={300} step={0.5} unit="kg" onChange={(v) => set("weightKg", v)} />
          </Q>
        )}

        {step === 3 && (
          <Q title="Qual é o seu objetivo principal?">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => {
                const Icon = GOAL_ICON[g];
                const on = a.goal === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set("goal", g)}
                    aria-pressed={on}
                    className={`flex flex-col items-start gap-3 rounded-3xl p-4 text-left transition-colors ${on ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card"}`}
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-2xl ${on ? "bg-fit-strong text-[#d6f94b]" : "bg-fit-card-2 text-fit-accent"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{GOAL_LABEL[g]}</span>
                      <span className={`mt-0.5 block text-[11px] leading-snug ${on ? "opacity-70" : "text-fit-muted"}`}>{GOAL_HINT[g]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Q>
        )}

        {step === 4 && (
          <Q title="Onde você quer chegar, e em quanto tempo?">
            <OptionalStepper
              label="Peso desejado"
              unit="kg"
              value={a.targetWeightKg}
              fallback={a.goal === "hipertrofia" ? a.weightKg + 5 : Math.max(40, a.weightKg - 6)}
              min={30}
              max={300}
              step={0.5}
              onChange={(v) => set("targetWeightKg", v)}
            />
            <OptionalStepper
              label="% de gordura desejado"
              unit="%"
              value={a.targetBodyFatPct}
              fallback={a.sex === "M" ? 15 : 23}
              min={5}
              max={45}
              step={0.5}
              onChange={(v) => set("targetBodyFatPct", v)}
            />
            <Label>Período do programa</Label>
            <Options
              value={a.programWeeks}
              onChange={(v) => set("programWeeks", v)}
              options={[8, 12, 16, 24, 36, 52].map((w) => ({ value: w, label: `${w} semanas`, hint: w >= 52 ? "1 ano" : `~${Math.round(w / 4.3)} meses` }))}
              cols={3}
            />
            <p className="mt-3 text-xs text-fit-muted">
              O programa é dividido em blocos de 4 semanas com fases diferentes (adaptação, volume, intensidade...) e semanas de descarga.
            </p>
          </Q>
        )}

        {step === 5 && (
          <Q title="Qual sua experiência com treino?">
            <Options
              value={a.level}
              onChange={(v) => set("level", v)}
              options={(Object.keys(LEVEL_LABEL) as Level[]).map((l) => ({ value: l, label: LEVEL_LABEL[l], hint: LEVEL_HINT[l] }))}
              cols={1}
            />
          </Q>
        )}

        {step === 6 && (
          <Q title="Como é sua rotina?">
            <Label>Em quais dias você vai treinar?</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_SHORT.map((d, i) => {
                const on = a.trainingDays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const next = on ? a.trainingDays.filter((x) => x !== i) : [...a.trainingDays, i].sort((x, y) => x - y);
                      if (next.length > 6) return;
                      setA((prev) => ({ ...prev, trainingDays: next, daysPerWeek: Math.max(1, next.length) }));
                    }}
                    aria-pressed={on}
                    className={`flex aspect-[3/4] flex-col items-center justify-center rounded-2xl text-xs font-bold ${on ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card text-fit-muted"}`}
                  >
                    {d}
                    {on && <CheckI className="mt-1 h-3.5 w-3.5" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-fit-muted">
              {a.trainingDays.length === 0
                ? "Escolha pelo menos 1 dia."
                : `${a.trainingDays.length} ${a.trainingDays.length === 1 ? "dia" : "dias"} por semana. ${a.trainingDays.length === 6 ? "Máximo de 6: o corpo precisa de 1 dia de descanso." : "O treino de cada dia é montado para os músculos descansarem entre um e outro."}`}
            </p>
            <Label>Tempo por treino</Label>
            <Options value={a.sessionMinutes} onChange={(v) => set("sessionMinutes", v)} options={[30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} min` }))} cols={5} />
            <Label>Período do dia</Label>
            <Options
              value={a.timeOfDay}
              onChange={(v) => set("timeOfDay", v)}
              options={(Object.keys(TIME_LABEL) as FitAnswers["timeOfDay"][]).map((t) => ({ value: t, label: TIME_LABEL[t] }))}
              cols={3}
            />
          </Q>
        )}

        {step === 7 && (
          <Q title="Onde você vai treinar e o que tem disponível?">
            <div className="grid grid-cols-2 gap-2">
              {PLACES.map((p) => {
                const on = p.equipment.every((e) => a.equipment.includes(e)) && a.trainingAtHome === p.home && (p.key !== "casa_zero" || a.equipment.length === 1);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setA((prev) => ({ ...prev, equipment: p.equipment, trainingAtHome: p.home }))}
                    className={`rounded-3xl p-4 text-left ${on ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card"}`}
                  >
                    <span className="block text-sm font-semibold">{p.label}</span>
                    <span className={`block text-[11px] ${on ? "opacity-70" : "text-fit-muted"}`}>{p.hint}</span>
                  </button>
                );
              })}
            </div>
            {a.equipment.includes("academia") ? (
              <p className="mt-4 rounded-2xl bg-fit-lime-soft p-3 text-xs">
                Academia completa inclui todos os aparelhos (leg press, polia, Smith, cadeiras, máquinas) e pesos livres. Se na sua faltar algo, escolha
                &quot;Academia do prédio / estúdio&quot; e marque só o que tem.
              </p>
            ) : (
              <>
                <Label>Aparelhos de academia</Label>
                <Chips
                  all={MACHINES}
                  selected={a.equipment}
                  label={(e) => EQUIPMENT_LABEL[e]}
                  onToggle={(e) => set("equipment", toggle(a.equipment, e))}
                />
                <Label>Pesos livres e acessórios</Label>
                <Chips
                  all={(Object.keys(EQUIPMENT_LABEL) as Equipment[]).filter((e) => e !== "peso_corporal" && e !== "academia" && !MACHINES.includes(e))}
                  selected={a.equipment}
                  label={(e) => EQUIPMENT_LABEL[e]}
                  onToggle={(e) => set("equipment", toggle(a.equipment, e))}
                />
              </>
            )}
          </Q>
        )}

        {step === 8 && (
          <Q title="Alguma dor, lesão ou condição de saúde?">
            <p className="-mt-2 mb-3 text-xs text-fit-muted">Exercícios de risco para essas regiões são trocados automaticamente.</p>
            <Chips
              all={Object.keys(LIMITATION_LABEL) as Limitation[]}
              selected={a.limitations}
              label={(l) => LIMITATION_LABEL[l]}
              onToggle={(l) => set("limitations", toggle(a.limitations, l))}
            />
            <button
              type="button"
              onClick={() => set("limitations", [])}
              className={`mt-3 w-full rounded-2xl p-3 text-sm font-medium ${a.limitations.length === 0 ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card"}`}
            >
              Nenhuma, estou 100%
            </button>
          </Q>
        )}

        {step === 9 && (
          <Q title="Quer dar prioridade a alguma região?">
            <p className="-mt-2 mb-3 text-xs text-fit-muted">Escolha quantas quiser. Essas regiões ganham exercícios e séries extras.</p>
            <Chips
              all={Object.keys(MUSCLE_LABEL) as Muscle[]}
              selected={a.focusMuscles}
              label={(m) => MUSCLE_LABEL[m]}
              onToggle={(m) => set("focusMuscles", toggle(a.focusMuscles, m))}
            />
            {a.focusMuscles.length > 0 && (
              <>
                <Label>Quanto foco?</Label>
                <Options
                  value={a.focusLevel}
                  onChange={(v) => set("focusLevel", v)}
                  options={(Object.keys(FOCUS_LEVEL_LABEL) as FocusLevel[]).map((k) => ({ value: k, label: FOCUS_LEVEL_LABEL[k].label, hint: FOCUS_LEVEL_LABEL[k].hint }))}
                  cols={1}
                />
                {a.focusMuscles.length > 4 && (
                  <p className="mt-3 rounded-2xl bg-fit-lime-soft p-3 text-xs">
                    Com {a.focusMuscles.length} regiões o foco é dividido entre elas ao longo da semana. Para sentir mais diferença, escolha até 3 ou 4.
                  </p>
                )}
              </>
            )}
          </Q>
        )}

        {step === 10 && (
          <Q title="Seu dia a dia">
            <Label>Nível de atividade fora do treino</Label>
            <Options
              value={a.activityLevel}
              onChange={(v) => set("activityLevel", v)}
              options={(Object.keys(ACTIVITY_LABEL) as FitAnswers["activityLevel"][]).map((k) => ({ value: k, label: ACTIVITY_LABEL[k] }))}
              cols={1}
            />
            <Stepper label="Horas de sono por noite" value={a.sleepHours} min={3} max={12} step={0.5} unit="h" onChange={(v) => set("sleepHours", v)} />
            <Label>Nível de estresse</Label>
            <div className="grid grid-cols-5 gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("stressLevel", n)}
                  className={`h-12 rounded-2xl text-sm font-bold ${a.stressLevel === n ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-fit-muted">
              <span>tranquilo</span>
              <span>muito estressado</span>
            </div>
            <Label>Você gosta de cardio?</Label>
            <Options
              value={a.likesCardio}
              onChange={(v) => set("likesCardio", v)}
              options={[
                { value: true, label: "Gosto" },
                { value: false, label: "Só o necessário" },
              ]}
              cols={2}
            />
          </Q>
        )}

        {step === 11 && (
          <Q title={`Tudo pronto, ${a.name.split(" ")[0] || "atleta"}!`}>
            <div className="divide-y divide-fit-line rounded-3xl bg-fit-card px-4">
              <Row k="Objetivo" v={GOAL_LABEL[a.goal]} onEdit={() => setStep(3)} />
              <Row
                k="Meta"
                v={[a.targetWeightKg ? `${a.targetWeightKg} kg` : null, a.targetBodyFatPct ? `${a.targetBodyFatPct}% gordura` : null].filter(Boolean).join(" · ") || "Automática"}
                onEdit={() => setStep(4)}
              />
              <Row k="Período" v={`${a.programWeeks} semanas`} onEdit={() => setStep(4)} />
              <Row k="Nível" v={LEVEL_LABEL[a.level]} onEdit={() => setStep(5)} />
              <Row
                k="Rotina"
                v={`${a.trainingDays.map((d) => WEEKDAY_SHORT[d]).join(", ")} · ${a.sessionMinutes} min · ${TIME_LABEL[a.timeOfDay]}`}
                onEdit={() => setStep(6)}
              />
              <Row k="Equipamentos" v={a.equipment.length ? a.equipment.map((e) => EQUIPMENT_LABEL[e]).join(", ") : "Peso corporal"} onEdit={() => setStep(7)} />
              <Row k="Limitações" v={a.limitations.length ? a.limitations.map((l) => LIMITATION_LABEL[l]).join(", ") : "Nenhuma"} onEdit={() => setStep(8)} />
              <Row
                k="Foco"
                v={a.focusMuscles.length ? `${a.focusMuscles.map((m) => MUSCLE_LABEL[m]).join(", ")} · ${FOCUS_LEVEL_LABEL[a.focusLevel].label}` : "Equilibrado"}
                onEdit={() => setStep(9)}
              />
            </div>
            {editing && (
              <label className="mt-4 flex items-start gap-3 rounded-2xl bg-fit-card p-4 text-sm">
                <input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--fit-lime)]" />
                <span>
                  Reiniciar o programa a partir da semana 1
                  <span className="block text-xs text-fit-muted">Deixe desmarcado para manter a semana atual.</span>
                </span>
              </label>
            )}
          </Q>
        )}
      </div>

      {error && <p className="mt-3 rounded-2xl bg-fit-bad/15 p-3 text-sm text-fit-bad">{error}</p>}

      <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-fit-bg via-fit-bg to-transparent pb-6 pt-4">
        {step < last ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={next}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-fit-lime text-base font-semibold text-fit-on-lime disabled:opacity-40"
          >
            Continuar <ArrowRightI className="h-5 w-5" />
          </button>
        ) : null}
        {step < last && editing && (
          <button type="button" disabled={pending || !canNext} onClick={submit} className="mt-2 h-12 w-full rounded-full bg-fit-card font-semibold disabled:opacity-50">
            {pending ? "Salvando..." : "Salvar agora"}
          </button>
        )}
        {step < last ? null : (
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-fit-lime text-base font-semibold text-fit-on-lime disabled:opacity-60"
          >
            {pending ? "Montando seu treino..." : editing ? "Salvar e recalcular" : "Gerar meu treino"}
          </button>
        )}
      </div>
    </div>
  );
}

function Q({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-5 text-2xl font-bold leading-tight tracking-tight">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-5 text-xs font-medium text-fit-muted">{children}</p>;
}

function Options<T extends string | number | boolean>({
  value,
  onChange,
  options,
  cols,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  cols: number;
}) {
  const grid = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 5: "grid-cols-5" }[cols] ?? "grid-cols-2";
  return (
    <div className={`grid gap-2 ${grid}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium ${on ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card"}`}
          >
            <span>
              {o.label}
              {o.hint && <span className={`block text-[11px] font-normal ${on ? "opacity-70" : "text-fit-muted"}`}>{o.hint}</span>}
            </span>
            {on && cols === 1 && <CheckI className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function Chips<T extends string>({ all, selected, label, onToggle }: { all: T[]; selected: T[]; label: (v: T) => string; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((v) => {
        const on = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            aria-pressed={on}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm ${on ? "bg-fit-lime font-medium text-fit-on-lime" : "bg-fit-card text-fit-muted"}`}
          >
            {on && <CheckI className="h-3.5 w-3.5" />}
            {label(v)}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div className="mt-3 rounded-3xl bg-fit-card p-4">
      <p className="text-xs text-fit-muted">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`Diminuir ${label}`} className="grid h-11 w-11 place-items-center rounded-full bg-fit-card-2 text-xl">
          −
        </button>
        <div className="flex flex-1 items-baseline justify-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) onChange(v);
            }}
            onBlur={() => onChange(clamp(value))}
            aria-label={label}
            className="w-24 bg-transparent text-center text-3xl font-bold tabular-nums outline-none"
          />
          {unit && <span className="text-sm text-fit-muted">{unit}</span>}
        </div>
        <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`Aumentar ${label}`} className="grid h-11 w-11 place-items-center rounded-full bg-fit-lime text-xl text-fit-on-lime">
          +
        </button>
      </div>
      {suffix && <p className="mt-1 text-center text-xs text-fit-muted">{suffix}</p>}
    </div>
  );
}

function OptionalStepper(props: {
  label: string;
  unit: string;
  value: number | null;
  fallback: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number | null) => void;
}) {
  if (props.value == null) {
    return (
      <button type="button" onClick={() => props.onChange(props.fallback)} className="mt-3 flex items-center justify-between rounded-3xl bg-fit-card p-4 text-left">
        <span>
          <span className="block text-sm font-medium">{props.label}</span>
          <span className="block text-xs text-fit-muted">Automático pelo objetivo. Toque para definir.</span>
        </span>
        <span className="rounded-full bg-fit-card-2 px-3 py-1 text-xs text-fit-accent">Definir</span>
      </button>
    );
  }
  return (
    <div className="relative">
      <Stepper label={props.label} value={props.value} min={props.min} max={props.max} step={props.step} unit={props.unit} onChange={props.onChange} />
      <button type="button" onClick={() => props.onChange(null)} className="absolute right-4 top-6 text-[11px] text-fit-muted underline">
        automático
      </button>
    </div>
  );
}

function Row({ k, v, onEdit }: { k: string; v: string; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit} className="flex w-full items-center justify-between gap-4 py-3.5 text-left">
      <span className="text-xs text-fit-muted">{k}</span>
      <span className="text-right text-sm font-medium">{v}</span>
    </button>
  );
}
