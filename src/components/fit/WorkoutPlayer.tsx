"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { saveWorkoutAction, setExercisePreferenceAction } from "@/app/fit/actions";
import type { Pattern } from "@/lib/fit/exercises";
import type { CardioBlock, PlannedExercise } from "@/lib/fit/program";
import type { LoadSuggestion } from "@/lib/fit/progression";
import { MUSCLE_LABEL } from "@/lib/fit/types";
import { ArrowLeftI, ArrowRightI, CheckI, ExitI, PauseI, PlayI, PlusI, SwapI } from "./FitIcons";
import { ExerciseMedia } from "./ui";
import { StretchSession, type SessionStretch } from "./StretchSession";

export type PlayerExercise = {
  plan: PlannedExercise;
  pattern: Pattern;
  suggestion: LoadSuggestion;
  bodyweight: boolean;
  alternatives: { id: string; name: string; cues: string[]; pattern: Pattern; unit: "reps" | "seg"; bodyweight: boolean }[];
};

type SetState = { reps: number; loadKg: number | null; done: boolean };
type ExState = {
  exerciseId: string;
  name: string;
  cues: string[];
  pattern: Pattern;
  unit: "reps" | "seg";
  bodyweight: boolean;
  sets: SetState[];
};
type Phase = "ready" | "countdown" | "work" | "rest" | "cardio" | "finish";
type State = {
  phase: Phase;
  ex: number;
  set: number;
  timerEndsAt: number | null;
  /** Hold timer for timed exercises: when it was started, if running. */
  holdStartedAt: number | null;
  startedAt: number | null;
  exercises: ExState[];
  rpe: number;
  notes: string;
};

function initialState(exercises: PlayerExercise[]): State {
  return {
    phase: "ready",
    ex: 0,
    set: 0,
    timerEndsAt: null,
    holdStartedAt: null,
    startedAt: null,
    rpe: 7,
    notes: "",
    exercises: exercises.map((e) => ({
      exerciseId: e.plan.exerciseId,
      name: e.plan.name,
      cues: e.plan.cues,
      pattern: e.pattern,
      unit: e.plan.unit,
      bodyweight: e.bodyweight,
      sets: Array.from({ length: e.plan.sets }, () => ({ reps: e.suggestion.reps, loadKg: e.suggestion.loadKg, done: false })),
    })),
  };
}

function nextPosition(exs: ExState[], e: number, s: number, groups: (string | null)[]): [number, number] | null {
  const g = groups[e];
  if (g) {
    if (groups[e + 1] === g && exs[e + 1]?.sets[s] && !exs[e + 1].sets[s].done) return [e + 1, s];
    if (groups[e - 1] === g && exs[e - 1]?.sets[s + 1] && !exs[e - 1].sets[s + 1].done) return [e - 1, s + 1];
  }
  const same = exs[e].sets.findIndex((x) => !x.done);
  if (same >= 0) return [e, same];
  for (let k = e + 1; k < exs.length; k++) {
    const i = exs[k].sets.findIndex((x) => !x.done);
    if (i >= 0) return [k, i];
  }
  for (let k = 0; k < e; k++) {
    const i = exs[k].sets.findIndex((x) => !x.done);
    if (i >= 0) return [k, i];
  }
  return null;
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
    navigator.vibrate?.([200, 80, 200]);
  } catch {
    // Audio is a nicety; ignore browsers that block it.
  }
}

const noopSubscribe = () => () => {};

export function WorkoutPlayer({
  storageKey,
  weekNumber,
  dayIndex,
  title,
  exercises,
  cardio,
  bodyKg,
  stretchesBefore,
  stretchesAfter,
}: {
  storageKey: string;
  weekNumber: number;
  dayIndex: number;
  title: string;
  exercises: PlayerExercise[];
  cardio: CardioBlock | null;
  bodyKg: number;
  stretchesBefore: SessionStretch[];
  stretchesAfter: SessionStretch[];
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(() => initialState(exercises));
  const [now, setNow] = useState(() => Date.now());
  const [showList, setShowList] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [stretching, setStretching] = useState<"antes" | "depois" | null>(null);
  const [warmedUp, setWarmedUp] = useState(false);
  const [swapForever, setSwapForever] = useState(true);
  const pendingPrefs = useRef<[string, string][]>([]);
  const [saved, setSaved] = useState<{ sets: number; volume: number; minutes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = useMemo(() => exercises.map((e) => e.plan.group), [exercises]);
  const firedRef = useRef<number | null>(null);

  // A workout in progress survives an accidental refresh or closed tab.
  const savedSnapshot = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    () => null,
  );

  useEffect(() => {
    if (state.phase === "ready" || state.phase === "finish") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Private mode / quota: progress just won't be restorable.
    }
  }, [state, storageKey]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // One ticker drives the on-screen clocks and the timer expiry transitions
  // (countdown → work, rest → work).
  const ticking = state.timerEndsAt != null || state.holdStartedAt != null;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = stateRef.current;
      if (!s.timerEndsAt || t < s.timerEndsAt || firedRef.current === s.timerEndsAt) return;
      firedRef.current = s.timerEndsAt;
      if (s.phase === "countdown") {
        setState((x) => ({ ...x, phase: "work", timerEndsAt: null, startedAt: x.startedAt ?? Date.now() }));
      } else if (s.phase === "rest") {
        beep();
        setState((x) => ({ ...x, phase: "work", timerEndsAt: null }));
      }
    }, 250);
    return () => clearInterval(id);
  }, [ticking]);

  // Keep the screen on while training.
  useEffect(() => {
    if (state.phase === "ready" || state.phase === "finish") return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [state.phase]);

  const remaining = state.timerEndsAt ? Math.max(0, Math.ceil((state.timerEndsAt - now) / 1000)) : 0;

  const cur = state.exercises[state.ex];
  const plan = exercises[state.ex]?.plan;
  const curSet = cur?.sets[state.set];
  const totalSets = state.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = state.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);

  const updateSet = useCallback(
    (patch: Partial<SetState>) =>
      setState((s) => ({
        ...s,
        exercises: s.exercises.map((e, i) =>
          i === s.ex ? { ...e, sets: e.sets.map((x, j) => (j === s.set ? { ...x, ...patch } : x)) } : e,
        ),
      })),
    [],
  );

  function completeSet() {
    setState((s) => {
      let heldReps: number | null = null;
      if (s.holdStartedAt) heldReps = Math.round((Date.now() - s.holdStartedAt) / 1000);
      const exs = s.exercises.map((e, i) =>
        i === s.ex
          ? { ...e, sets: e.sets.map((x, j) => (j === s.set ? { ...x, done: true, reps: heldReps ?? x.reps } : x)) }
          : e,
      );
      // Carry this set's load/reps into the following untouched sets.
      const done = exs[s.ex].sets[s.set];
      exs[s.ex] = {
        ...exs[s.ex],
        sets: exs[s.ex].sets.map((x, j) => (j > s.set && !x.done ? { ...x, loadKg: done.loadKg ?? x.loadKg } : x)),
      };
      const next = nextPosition(exs, s.ex, s.set, groups);
      if (!next) {
        return { ...s, exercises: exs, holdStartedAt: null, timerEndsAt: null, phase: cardio ? "cardio" : "finish" };
      }
      const [ne, ns] = next;
      const biset = groups[s.ex] && groups[ne] === groups[s.ex] && ne === s.ex + 1;
      const rest = biset ? Math.min(15, exercises[s.ex].plan.restSec) : exercises[s.ex].plan.restSec;
      return {
        ...s,
        exercises: exs,
        ex: ne,
        set: ns,
        holdStartedAt: null,
        phase: rest > 0 ? "rest" : "work",
        timerEndsAt: rest > 0 ? Date.now() + rest * 1000 : null,
      };
    });
  }

  function goTo(ex: number) {
    setState((s) => {
      const idx = s.exercises[ex].sets.findIndex((x) => !x.done);
      return { ...s, ex, set: idx >= 0 ? idx : s.exercises[ex].sets.length - 1, phase: "work", timerEndsAt: null, holdStartedAt: null };
    });
    setShowList(false);
  }

  function addSet() {
    setState((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i === s.ex ? { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1], done: false }] } : e)),
    }));
  }

  function swap(altId: string) {
    const alt = exercises[state.ex].alternatives.find((a) => a.id === altId);
    if (!alt) return;
    if (swapForever) {
      // Applied after the workout is saved: changing the plan mid-session
      // would reshuffle the exercise list under the player.
      pendingPrefs.current.push([state.exercises[state.ex].exerciseId, alt.id]);
    }
    setState((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i === s.ex ? { ...e, exerciseId: alt.id, name: alt.name, cues: alt.cues, pattern: alt.pattern, unit: alt.unit, bodyweight: alt.bodyweight, sets: e.sets.map((x) => ({ ...x, loadKg: null })) } : e,
      ),
    }));
    setShowSwap(false);
  }

  function finishNow() {
    setState((s) => ({ ...s, phase: "finish", timerEndsAt: null, holdStartedAt: null }));
  }

  function save() {
    setError(null);
    const entries = state.exercises
      .map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((x) => ({ reps: x.reps, loadKg: x.loadKg, done: x.done })) }))
      .filter((e) => e.sets.some((x) => x.done));
    start(async () => {
      const minutes = state.startedAt ? Math.max(1, Math.round((Date.now() - state.startedAt) / 60000)) : null;
      const res = await saveWorkoutAction({
        weekNumber,
        dayIndex,
        title,
        durationMin: minutes,
        rpe: state.rpe,
        notes: state.notes.trim() || null,
        entries,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      for (const [removed, kept] of pendingPrefs.current) {
        await setExercisePreferenceAction(removed, "excluir");
        await setExercisePreferenceAction(kept, "manter");
      }
      pendingPrefs.current = [];
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      const volume = entries.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + x.reps * (x.loadKg ?? 0), 0), 0);
      setSaved({ sets: doneSets, volume, minutes: minutes ?? 0 });
    });
  }

  // ------------------------------------------------------------------ views

  if (stretching) {
    return (
      <StretchSession
        title={stretching === "antes" ? "Aquecimento" : "Volta à calma"}
        items={stretching === "antes" ? stretchesBefore : stretchesAfter}
        doneLabel={stretching === "antes" ? "Começar o treino" : "Voltar"}
        onClose={(completed) => {
          if (stretching === "antes" && completed) setWarmedUp(true);
          setStretching(null);
        }}
      />
    );
  }

  if (saved) {
    const kcal = Math.round(((5.5 * 3.5 * bodyKg) / 200) * saved.minutes);
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur">
        <div className="fit-pop w-full max-w-sm rounded-[36px] bg-fit-lime p-7 text-center text-fit-on-lime">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-black/10">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-fit-strong text-[#d6f94b]">
              <CheckI className="h-10 w-10" strokeWidth={3} />
            </div>
          </div>
          <h2 className="mt-5 text-3xl font-bold">Parabéns!</h2>
          <p className="mt-1 text-sm opacity-75">{title} concluído. Cada treino conta.</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Result label="séries" value={saved.sets} />
            <Result label="minutos" value={saved.minutes} />
            <Result label="kcal" value={kcal} />
          </div>
          {saved.volume > 0 && <p className="mt-3 text-xs opacity-70">Volume total: {Math.round(saved.volume).toLocaleString("pt-BR")} kg levantados</p>}
          <button
            type="button"
            onClick={() => {
              router.push("/fit");
              router.refresh();
            }}
            className="mt-6 h-12 w-full rounded-full bg-fit-strong font-semibold text-[#d6f94b]"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "ready") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-fit-lime text-fit-on-lime">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col p-6">
          <Link href={`/fit/treino/${dayIndex}`} aria-label="Voltar" className="grid h-9 w-9 place-items-center rounded-full bg-fit-strong text-white">
            <ArrowLeftI className="h-4 w-4" />
          </Link>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium opacity-70">{title}</p>
            <h1 className="mt-2 text-5xl font-bold tracking-tight">Prepare-se</h1>
            <p className="mt-3 max-w-xs text-sm opacity-70">
              {exercises.length} exercícios · {totalSets} séries{cardio ? ` · ${cardio.minutes} min de cardio` : ""}. Faça o aquecimento antes de começar.
            </p>
          </div>
          <div className="space-y-2 pb-4">
            {savedSnapshot && (
              <button
                type="button"
                onClick={() => {
                  try {
                    const restored = JSON.parse(savedSnapshot) as State;
                    setState({ ...restored, phase: restored.phase === "countdown" ? "work" : restored.phase, timerEndsAt: null, holdStartedAt: null });
                  } catch {
                    setState((s) => ({ ...s, phase: "countdown", timerEndsAt: Date.now() + 3000 }));
                  }
                }}
                className="h-14 w-full rounded-full bg-black/10 font-semibold"
              >
                Continuar de onde parei
              </button>
            )}
            {stretchesBefore.length > 0 && (
              <button
                type="button"
                onClick={() => setStretching("antes")}
                className="h-14 w-full rounded-full bg-black/10 font-semibold"
              >
                {warmedUp ? "Aquecimento feito. Repetir?" : `Aquecer com alongamentos (${Math.max(1, Math.round(stretchesBefore.reduce((a, x) => a + x.seconds + 5, 0) / 60))} min)`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setState((s) => ({ ...initialState(exercises), phase: "countdown", timerEndsAt: Date.now() + 3000, rpe: s.rpe }))}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-fit-strong text-base font-semibold text-[#d6f94b]"
            >
              <PlayI className="h-4 w-4" /> {savedSnapshot ? "Começar do zero" : "Estou pronto"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "countdown") {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-fit-lime text-fit-on-lime">
        <div className="text-center">
          <p key={remaining} className="fit-pop text-[160px] font-bold leading-none tabular-nums">
            {Math.max(1, remaining)}
          </p>
          <p className="mt-2 text-lg font-semibold opacity-70">Prepare-se</p>
        </div>
      </div>
    );
  }

  if (state.phase === "finish") {
    return (
      <div className="flex min-h-screen flex-col gap-4 pb-8 pt-6">
        <h1 className="text-2xl font-bold">Como foi o treino?</h1>
        {stretchesAfter.length > 0 && (
          <button type="button" onClick={() => setStretching("depois")} className="flex items-center gap-3 rounded-[28px] bg-fit-lime p-4 text-left text-fit-on-lime">
            <span className="flex-1">
              <span className="block font-semibold">Alongar agora</span>
              <span className="block text-xs opacity-75">{stretchesAfter.length} alongamentos para os músculos que você treinou</span>
            </span>
            <PlayI className="h-5 w-5" />
          </button>
        )}
        <div className="rounded-[28px] bg-fit-card p-5">
          <p className="text-sm text-fit-muted">Esforço percebido (1 = muito leve, 10 = máximo)</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setState((s) => ({ ...s, rpe: n }))}
                className={`h-11 rounded-2xl text-sm font-bold ${state.rpe === n ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card-2"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Anotações (dor, energia, algo a ajustar...)"
            rows={3}
            className="mt-4 w-full rounded-2xl bg-fit-card-2 p-3 text-sm outline-none ring-fit-lime focus:ring-2"
          />
        </div>
        <div className="rounded-[28px] bg-fit-card p-5 text-sm">
          <p>
            <span className="text-2xl font-bold text-fit-accent">{doneSets}</span>
            <span className="text-fit-muted"> de {totalSets} séries concluídas</span>
          </p>
        </div>
        {error && <p className="rounded-2xl bg-fit-bad/15 p-3 text-sm text-fit-bad">{error}</p>}
        <button
          type="button"
          disabled={pending || doneSets === 0}
          onClick={save}
          className="h-14 rounded-full bg-fit-lime font-semibold text-fit-on-lime disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar treino"}
        </button>
        <button type="button" onClick={() => setState((s) => ({ ...s, phase: "work" }))} className="h-12 rounded-full bg-fit-card font-medium">
          Voltar ao treino
        </button>
      </div>
    );
  }

  if (state.phase === "cardio" && cardio) {
    return (
      <CardioView
        cardio={cardio}
        onDone={() => setState((s) => ({ ...s, phase: "finish" }))}
        onBack={() => setState((s) => ({ ...s, phase: "work" }))}
      />
    );
  }

  // work / rest
  const held = state.holdStartedAt ? Math.floor((now - state.holdStartedAt) / 1000) : 0;
  const isRest = state.phase === "rest";
  const nextUp = isRest ? state.exercises[state.ex] : null;
  const bigNumber = isRest ? remaining : cur.unit === "seg" ? (state.holdStartedAt ? held : curSet.reps) : curSet.reps;

  return (
    <div className="flex min-h-screen flex-col gap-3 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={finishNow} className="flex items-center gap-1.5 rounded-full bg-fit-card px-3 py-2 text-xs font-medium">
          <ExitI className="h-4 w-4" /> Encerrar
        </button>
        <p className="text-xs tabular-nums text-fit-muted">
          {doneSets}/{totalSets} séries
        </p>
        <button type="button" onClick={() => setShowList(true)} className="rounded-full bg-fit-card px-3 py-2 text-xs font-medium">
          Ver todos
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fit-card-3">
        <div className="h-full rounded-full bg-fit-lime transition-[width]" style={{ width: `${(doneSets / totalSets) * 100}%` }} />
      </div>

      <div className="relative overflow-hidden rounded-[32px] bg-fit-card">
        <div className="relative">
          <ExerciseMedia id={cur.exerciseId} pattern={cur.pattern} size="lg" className="h-64" />
          {isRest ? (
            // Rest: dim the photo of what's next and show the countdown big.
            <div className="absolute inset-0 grid place-items-center bg-black/55">
              <p className="text-[120px] font-bold leading-none tabular-nums text-fit-lime drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">{bigNumber}</p>
            </div>
          ) : (
            // Working: keep the demo visible; the target sits in the corner.
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 pt-16">
              <p key={`${state.ex}-${state.set}`} className="fit-pop text-7xl font-bold leading-none tabular-nums text-fit-lime drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                {bigNumber}
              </p>
            </div>
          )}
          <span className="absolute left-4 top-4 rounded-full bg-fit-strong/80 px-3 py-1 text-[11px] font-semibold text-white">
            {isRest ? "Descanso" : cur.unit === "seg" ? "segundos" : "repetições"}
          </span>
        </div>
        <div className="p-5">
          <p className="text-xs text-fit-muted">
            {isRest ? "A seguir" : `Série ${state.set + 1} de ${cur.sets.length}`} · {MUSCLE_LABEL[exercises[state.ex].plan.muscle]}
            {plan.group ? ` · bi-set ${plan.group}` : ""}
          </p>
          <h1 className="text-xl font-bold leading-tight">{(nextUp ?? cur).name}</h1>
          {isRest ? (
            <p className="mt-1 text-sm text-fit-muted">
              Série {state.set + 1} de {cur.sets.length} · meta {plan.reps}
              {curSet.loadKg ? ` com ${curSet.loadKg} kg` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-fit-muted">
              Meta: {plan.reps} {cur.unit === "seg" ? "" : "reps"} · RIR {plan.rir} · cadência {plan.tempo}
            </p>
          )}
          {state.set === 0 && !isRest && <p className="mt-2 rounded-2xl bg-fit-lime-soft p-2 text-xs">{exercises[state.ex].suggestion.message}</p>}
        </div>
      </div>

      {isRest ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, timerEndsAt: (s.timerEndsAt ?? Date.now()) + 15000 }))}
            className="h-12 rounded-full bg-fit-card font-medium"
          >
            +15s
          </button>
          <button type="button" onClick={() => setState((s) => ({ ...s, phase: "work", timerEndsAt: null }))} className="h-12 rounded-full bg-fit-lime font-semibold text-fit-on-lime">
            Pular descanso
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {cur.unit === "reps" && !cur.bodyweight && (
              <NumberBox label="Carga (kg)" value={curSet.loadKg} step={exercises[state.ex].plan.muscle === "quadriceps" ? 2.5 : 1} onChange={(v) => updateSet({ loadKg: v })} nullable />
            )}
            <NumberBox
              label={cur.unit === "seg" ? "Segundos" : "Repetições"}
              value={curSet.reps}
              step={cur.unit === "seg" ? 5 : 1}
              onChange={(v) => updateSet({ reps: v ?? 0 })}
              className={cur.unit === "seg" || cur.bodyweight ? "col-span-2" : ""}
            />
          </div>
          {cur.unit === "seg" && (
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, holdStartedAt: s.holdStartedAt ? null : Date.now() }))}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-fit-card font-medium"
            >
              {state.holdStartedAt ? <PauseI className="h-4 w-4" /> : <PlayI className="h-4 w-4" />}
              {state.holdStartedAt ? `Cronometrando: ${held}s` : "Iniciar cronômetro"}
            </button>
          )}
          <button type="button" onClick={completeSet} className="flex h-14 items-center justify-center gap-2 rounded-full bg-fit-lime text-base font-semibold text-fit-on-lime">
            <CheckI className="h-5 w-5" strokeWidth={3} /> Concluir série
          </button>
          <div className="flex justify-center gap-2 text-xs">
            <button type="button" onClick={addSet} className="flex items-center gap-1 rounded-full bg-fit-card px-3 py-2">
              <PlusI className="h-3.5 w-3.5" /> Série extra
            </button>
            {exercises[state.ex].alternatives.length > 0 && (
              <button type="button" onClick={() => setShowSwap(true)} className="flex items-center gap-1 rounded-full bg-fit-card px-3 py-2">
                <SwapI className="h-3.5 w-3.5" /> Trocar exercício
              </button>
            )}
          </div>
          <details className="rounded-3xl bg-fit-card p-4 text-sm">
            <summary className="cursor-pointer font-medium">Como executar</summary>
            <ul className="mt-2 space-y-1 text-fit-muted">
              {cur.cues.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </details>
        </>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2 rounded-[28px] bg-fit-card p-2">
        <button
          type="button"
          disabled={state.ex === 0}
          onClick={() => goTo(state.ex - 1)}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-fit-strong text-sm font-medium text-[#d6f94b] disabled:opacity-40"
        >
          <ArrowLeftI className="h-4 w-4" /> Anterior
        </button>
        <button
          type="button"
          onClick={() => (state.ex < state.exercises.length - 1 ? goTo(state.ex + 1) : setState((s) => ({ ...s, phase: cardio ? "cardio" : "finish" })))}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-fit-lime text-sm font-semibold text-fit-on-lime"
        >
          {state.ex < state.exercises.length - 1 ? "Próximo" : cardio ? "Cardio" : "Finalizar"} <ArrowRightI className="h-4 w-4" />
        </button>
      </div>

      {showList && (
        <Sheet onClose={() => setShowList(false)} title="Exercícios de hoje">
          <ul className="space-y-2">
            {state.exercises.map((e, i) => {
              const d = e.sets.filter((x) => x.done).length;
              return (
                <li key={i}>
                  <button type="button" onClick={() => goTo(i)} className={`flex w-full items-center gap-3 rounded-3xl p-2 text-left ${i === state.ex ? "bg-fit-lime-soft" : "bg-fit-card-2"}`}>
                    <ExerciseMedia id={e.exerciseId} pattern={e.pattern} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fit-accent">{e.name}</span>
                      <span className="block text-xs text-fit-muted">
                        {d}/{e.sets.length} séries · {exercises[i].plan.reps}
                      </span>
                    </span>
                    {d === e.sets.length && <CheckI className="h-5 w-5 text-fit-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={finishNow} className="mt-4 h-12 w-full rounded-full bg-fit-lime font-semibold text-fit-on-lime">
            Finalizar treino
          </button>
        </Sheet>
      )}

      {showSwap && (
        <Sheet onClose={() => setShowSwap(false)} title="Trocar por">
          <label className="mb-3 flex items-start gap-3 rounded-2xl bg-fit-card-2 p-3 text-sm">
            <input type="checkbox" checked={swapForever} onChange={(e) => setSwapForever(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--fit-lime)]" />
            <span>
              Trocar sempre
              <span className="block text-xs text-fit-muted">
                &quot;{state.exercises[state.ex].name}&quot; sai do seu treino e a opção escolhida fica no lugar nas próximas semanas.
              </span>
            </span>
          </label>
          <ul className="space-y-2">
            {exercises[state.ex].alternatives.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => swap(a.id)} className="flex w-full items-center gap-3 rounded-3xl bg-fit-card-2 p-2 text-left">
                  <ExerciseMedia id={a.id} pattern={a.pattern} size="sm" />
                  <span className="text-sm font-semibold">{a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

function CardioView({ cardio, onDone, onBack }: { cardio: CardioBlock; onDone: () => void; onBack: () => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const total = cardio.minutes * 60;
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      const e = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(e);
      if (e === total) beep();
    }, 500);
    return () => clearInterval(id);
  }, [startedAt, total]);
  const left = Math.max(0, total - elapsed);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="flex min-h-screen flex-col gap-4 pb-6 pt-6">
      <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full bg-fit-strong text-white" aria-label="Voltar">
        <ArrowLeftI className="h-4 w-4" />
      </button>
      <div className="rounded-[32px] bg-fit-card p-6 text-center">
        <p className="text-xs text-fit-muted">Cardio · {cardio.minutes} min</p>
        <h1 className="mt-1 text-2xl font-bold">{cardio.title}</h1>
        <p className="mt-1 text-sm text-fit-muted">{cardio.description}</p>
        <p className="mt-8 text-7xl font-bold tabular-nums text-fit-accent">
          {mm}:{ss}
        </p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-fit-card-3">
          <div className="h-full bg-fit-lime" style={{ width: `${(elapsed / total) * 100}%` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setStartedAt((s) => (s ? null : Date.now() - elapsed * 1000))}
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-fit-card font-semibold"
      >
        {startedAt ? <PauseI className="h-4 w-4" /> : <PlayI className="h-4 w-4" />} {startedAt ? "Pausar" : elapsed ? "Retomar" : "Iniciar"}
      </button>
      <button type="button" onClick={onDone} className="h-14 rounded-full bg-fit-lime font-semibold text-fit-on-lime">
        {left === 0 ? "Concluir" : "Pular / concluir cardio"}
      </button>
    </div>
  );
}

function NumberBox({
  label,
  value,
  step,
  onChange,
  nullable,
  className = "",
}: {
  label: string;
  value: number | null;
  step: number;
  onChange: (v: number | null) => void;
  nullable?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl bg-fit-card p-3 ${className}`}>
      <p className="text-center text-[11px] text-fit-muted">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <button type="button" onClick={() => onChange(Math.max(0, (value ?? 0) - step))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fit-card-2" aria-label={`Diminuir ${label}`}>
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          placeholder={nullable ? "—" : "0"}
          onChange={(e) => onChange(e.target.value === "" ? (nullable ? null : 0) : Number(e.target.value))}
          aria-label={label}
          className="w-full min-w-0 bg-transparent text-center text-2xl font-bold tabular-nums outline-none"
        />
        <button type="button" onClick={() => onChange((value ?? 0) + step)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fit-lime text-fit-on-lime" aria-label={`Aumentar ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="fit-rise mx-auto max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-fit-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-fit-card-3" />
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Result({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-black/10 py-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] opacity-70">{label}</p>
    </div>
  );
}
