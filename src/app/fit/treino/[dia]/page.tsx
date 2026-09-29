import Link from "next/link";
import { notFound } from "next/navigation";
import { loadFitContext } from "@/lib/fit/server";
import { getExercise } from "@/lib/fit/exercises";
import { PHASE_INFO, WEEKDAY_LONG } from "@/lib/fit/program";
import { suggestNext } from "@/lib/fit/progression";
import { LEVEL_LABEL, MUSCLE_LABEL } from "@/lib/fit/types";
import { dayKey } from "@/lib/fit/time";
import { Card, ExerciseMedia, SectionTitle } from "@/components/fit/ui";
import { ExercisePrefButtons, RemovedBanner } from "@/components/fit/ExercisePrefButtons";
import { ArrowLeftI, BoltI, ChevronRightI, ClockI, FlameI, PlayI, SwapI } from "@/components/fit/FitIcons";

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ dia: string }>;
  searchParams: Promise<{ removido?: string }>;
}) {
  const { dia } = await params;
  const { removido } = await searchParams;
  const ctx = await loadFitContext();
  const day = ctx.week.days[Number(dia)];
  if (!day || !/^\d+$/.test(dia)) notFound();
  const first = getExercise(day.exercises[0]?.exerciseId ?? "");
  const doneToday = ctx.logs.some((l) => l.dayIndex === day.index && l.weekNumber === ctx.week.week && dayKey(l.performedAt) === dayKey());
  const doneThisWeek = ctx.logs.filter((l) => l.weekNumber === ctx.week.week && l.dayIndex === day.index).length;
  const totalSets = day.exercises.reduce((a, e) => a + e.sets, 0);

  return (
    <main className="flex flex-col gap-4 pt-4">
      <div className="relative overflow-hidden rounded-[32px]">
        <ExerciseMedia id={first?.id ?? ""} pattern={first?.pattern ?? "core"} size="lg" animate={false} />
        <Link href="/fit/treino" aria-label="Voltar" className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-fit-strong text-white">
          <ArrowLeftI className="h-4 w-4" />
        </Link>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-16 text-white">
          <p className="text-xs text-white/70">
            {WEEKDAY_LONG[day.weekday]} · Semana {ctx.week.week}
          </p>
          <h1 className="text-2xl font-bold leading-tight">{day.title}</h1>
          <div className="mt-3 flex gap-2">
            <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-black">
              <ClockI className="h-3.5 w-3.5" /> {day.estMinutes} min
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-black">
              <FlameI className="h-3.5 w-3.5" /> {day.estKcal} kcal
            </span>
          </div>
        </div>
      </div>

      {removido && getExercise(removido) && (
        <RemovedBanner
          exerciseId={removido}
          name={getExercise(removido)!.name}
          replacement={
            (
              day.exercises.find((p) => p.muscle === getExercise(removido)!.muscle && getExercise(p.exerciseId)?.pattern === getExercise(removido)!.pattern) ??
              day.exercises.find((p) => getExercise(p.exerciseId)?.pattern === getExercise(removido)!.pattern)
            )?.name ?? null
          }
        />
      )}

      <Card>
        <SectionTitle>Sobre</SectionTitle>
        <p className="text-sm text-fit-muted">
          Fase de {PHASE_INFO[ctx.week.phase].label.toLowerCase()}: {PHASE_INFO[ctx.week.phase].description.toLowerCase()} {day.exercises.length} exercícios,{" "}
          {totalSets} séries{day.cardio ? ` e ${day.cardio.minutes} min de cardio` : ""}.
        </p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-fit-line border-t border-fit-line pt-3 text-center">
          <div>
            <p className="text-[11px] text-fit-muted">Nível</p>
            <p className="text-sm font-semibold text-fit-accent">{LEVEL_LABEL[ctx.answers.level]}</p>
          </div>
          <div>
            <p className="text-[11px] text-fit-muted">Nesta semana</p>
            <p className="text-sm font-semibold text-fit-accent">{doneThisWeek > 0 ? "Feito" : "0%"}</p>
          </div>
          <div>
            <p className="text-[11px] text-fit-muted">Foco</p>
            <p className="truncate px-1 text-sm font-semibold text-fit-accent">{MUSCLE_LABEL[day.focus[0]]}</p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Aquecimento</SectionTitle>
        <ol className="space-y-2 text-sm">
          {day.warmup.map((w, i) => (
            <li key={w} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fit-card-2 text-[11px] font-bold text-fit-accent">{i + 1}</span>
              <span className="text-fit-muted">{w}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <SectionTitle>
          Exercícios
          <span className="ml-2 text-xs font-normal text-fit-muted">
            {day.exercises.length} exercícios · {totalSets} séries
          </span>
        </SectionTitle>
        <p className="-mt-1 mb-3 text-xs text-fit-muted">Toque num exercício para ver como fazer, manter ou trocar por outro.</p>
        <ul className="space-y-3">
          {day.exercises.map((p, i) => {
            const ex = getExercise(p.exerciseId)!;
            const sug = suggestNext(p, ctx.logs);
            return (
              <li key={p.exerciseId}>
                <details className="group rounded-3xl bg-fit-card-2 p-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <ExerciseMedia id={ex.id} pattern={ex.pattern} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-fit-muted">
                        {i + 1}
                        {p.group ? ` · bi-set ${p.group}` : ""} · {MUSCLE_LABEL[p.muscle]}
                        {p.isFocus && <span className="ml-1.5 rounded-full bg-fit-lime px-1.5 py-px text-[9px] font-bold text-fit-on-lime">FOCO</span>}
                      </p>
                      <p className="truncate text-sm font-semibold text-fit-accent">{p.name}</p>
                      <p className="text-xs text-fit-muted">
                        {p.sets} × {p.reps} · {p.restSec}s descanso · RIR {p.rir}
                      </p>
                    </div>
                    <ChevronRightI className="h-4 w-4 shrink-0 text-fit-muted transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-3 space-y-3 border-t border-fit-line pt-3 text-xs">
                    <ExerciseMedia id={ex.id} pattern={ex.pattern} size="lg" labels />
                    <ExercisePrefButtons exerciseId={ex.id} pref={ctx.answers.favoriteExercises.includes(ex.id) ? "manter" : "neutro"} />
                    <Link href={`/fit/exercicios/${ex.id}`} className="inline-block text-fit-accent underline">
                      Ver passo a passo
                    </Link>
                    <ul className="space-y-1 text-fit-muted">
                      {p.cues.map((c) => (
                        <li key={c}>• {c}</li>
                      ))}
                    </ul>
                    <p>
                      <span className="text-fit-muted">Cadência:</span> {p.tempo} (descida-pausa-subida)
                    </p>
                    {p.note && <p className="rounded-2xl bg-fit-lime-soft p-2 text-fit-ink">{p.note}</p>}
                    <p className="rounded-2xl bg-fit-card p-2">
                      <BoltI className="mr-1 inline h-3.5 w-3.5 text-fit-accent" />
                      {sug.message}
                    </p>
                    {p.alternatives.length > 0 && (
                      <p className="text-fit-muted">
                        <SwapI className="mr-1 inline h-3.5 w-3.5" />
                        Alternativas: {p.alternatives.map((a) => a.name).join(", ")}
                      </p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </Card>

      {day.cardio && (
        <Card>
          <SectionTitle>Cardio · {day.cardio.minutes} min</SectionTitle>
          <p className="font-semibold">{day.cardio.title}</p>
          <p className="text-sm text-fit-muted">{day.cardio.description}</p>
        </Card>
      )}

      <Card>
        <SectionTitle>Volta à calma</SectionTitle>
        <ul className="space-y-1 text-sm text-fit-muted">
          {day.cooldown.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
      </Card>

      <div className="sticky bottom-24 z-10">
        <Link
          href={`/fit/treino/${day.index}/play`}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-fit-lime text-base font-semibold text-fit-on-lime shadow-xl shadow-black/30"
        >
          <PlayI className="h-4 w-4" /> {doneToday ? "Treinar de novo" : "Começar treino"}
        </Link>
      </div>
    </main>
  );
}
