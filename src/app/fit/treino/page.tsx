import Link from "next/link";
import { loadFitContext } from "@/lib/fit/server";
import { PHASE_INFO, WEEKDAY_LONG, buildBlocks, weeklyVolume } from "@/lib/fit/program";
import { getExercise } from "@/lib/fit/exercises";
import { GOAL_LABEL, LEVEL_LABEL, MUSCLE_LABEL } from "@/lib/fit/types";
import { oneRepMax } from "@/lib/fit/progression";
import { Card, ExerciseMedia, SectionTitle, TopBar, fmtDate, fmtNum } from "@/components/fit/ui";
import { ClockI, FlameI } from "@/components/fit/FitIcons";
import { DeleteWorkoutButton } from "@/components/fit/DeleteButtons";

type Tab = "semana" | "programa" | "historico";

export default async function TreinoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const tab: Tab = aba === "programa" || aba === "historico" ? aba : "semana";
  const ctx = await loadFitContext();
  const { week, answers, logs } = ctx;

  return (
    <main className="flex flex-col gap-4">
      <TopBar title="Treino" />
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Seções do treino">
        {(
          [
            ["semana", "Esta semana"],
            ["programa", "Programa"],
            ["historico", "Histórico"],
          ] as const
        ).map(([k, label]) => (
          <Link
            key={k}
            href={k === "semana" ? "/fit/treino" : `/fit/treino?aba=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium ${tab === k ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card-2 text-fit-muted"}`}
          >
            {label}
          </Link>
        ))}
        <Link href="/fit/exercicios" className="shrink-0 rounded-full bg-fit-card-2 px-4 py-2 text-[13px] font-medium text-fit-muted">
          Exercícios
        </Link>
      </nav>

      {tab === "semana" && <WeekTab ctx={ctx} />}
      {tab === "programa" && <ProgramTab ctx={ctx} />}
      {tab === "historico" && (
        <section id="historico" className="flex flex-col gap-3">
          {logs.length === 0 && <Card><p className="text-sm text-fit-muted">Seus treinos concluídos aparecem aqui.</p></Card>}
          {logs.map((l) => {
            const sets = l.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
            const volume = l.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).reduce((x, s) => x + s.reps * (s.loadKg ?? 0), 0), 0);
            const best = l.entries
              .map((e) => {
                const top = e.sets.filter((s) => s.done && s.loadKg).map((s) => oneRepMax(s.loadKg!, s.reps));
                return top.length ? { name: getExercise(e.exerciseId)?.name ?? e.exerciseId, rm: Math.max(...top) } : null;
              })
              .filter((x): x is { name: string; rm: number } => !!x)
              .sort((a, b) => b.rm - a.rm)[0];
            return (
              <Card key={l.id} flush className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-fit-muted">
                      {fmtDate(l.performedAt, { weekday: "short", day: "2-digit", month: "short" })} · semana {l.weekNumber}
                    </p>
                    <p className="truncate font-semibold">{l.title}</p>
                  </div>
                  <DeleteWorkoutButton id={l.id} />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <Mini label="séries" value={sets} />
                  <Mini label="volume" value={`${fmtNum(volume / 1000)}t`} />
                  <Mini label="min" value={l.durationMin ?? "–"} />
                  <Mini label="esforço" value={l.rpe ? `${l.rpe}/10` : "–"} />
                </div>
                {best && (
                  <p className="mt-3 text-xs text-fit-muted">
                    Melhor marca: <span className="text-fit-ink">{best.name}</span> · 1RM estimado {fmtNum(best.rm)} kg
                  </p>
                )}
              </Card>
            );
          })}
        </section>
      )}
      <p className="text-center text-[11px] text-fit-faint">
        {GOAL_LABEL[week.goal]} · {LEVEL_LABEL[answers.level]} · {answers.daysPerWeek}x por semana
      </p>
    </main>
  );
}

function WeekTab({ ctx }: { ctx: Awaited<ReturnType<typeof loadFitContext>> }) {
  const { week } = ctx;
  const volume = weeklyVolume(week);
  const maxSets = Math.max(1, ...volume.map((v) => v.sets));
  return (
    <>
      <Card tone="lime">
        <p className="text-xs font-semibold opacity-70">
          Semana {week.week} de {week.totalWeeks} · Bloco {week.block.index + 1}
        </p>
        <h2 className="mt-1 text-2xl font-bold">
          {PHASE_INFO[week.phase].label}
          {week.deload ? " · Descarga" : ""}
        </h2>
        <p className="mt-1 text-sm opacity-80">{PHASE_INFO[week.phase].description}</p>
        {week.notes.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs">
            {week.notes.map((n) => (
              <li key={n} className="rounded-2xl bg-black/10 px-3 py-2">
                {n}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {week.days.map((d) => {
          const first = getExercise(d.exercises[0]?.exerciseId ?? "");
          return (
            <Link key={d.index} href={`/fit/treino/${d.index}`} className="group overflow-hidden rounded-[26px] bg-fit-card">
              <div className="relative">
                <ExerciseMedia id={first?.id ?? ""} pattern={first?.pattern ?? "core"} animate={false} />
                <span className="absolute right-2 top-2 rounded-full bg-fit-strong/80 px-2 py-0.5 text-[10px] font-semibold text-[#d6f94b]">
                  {WEEKDAY_LONG[d.weekday].slice(0, 3)}
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{d.title}</p>
                <p className="mt-2 flex items-center gap-2 text-[11px] text-fit-muted">
                  <span className="flex items-center gap-0.5">
                    <ClockI className="h-3 w-3" />
                    {d.estMinutes} min
                  </span>
                  <span className="flex items-center gap-0.5">
                    <FlameI className="h-3 w-3" />
                    {d.estKcal}
                  </span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <Card>
        <SectionTitle>Séries por músculo na semana</SectionTitle>
        <ul className="space-y-2">
          {volume.map((v) => (
            <li key={v.muscle} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 text-fit-muted">{v.label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-fit-card-3">
                <span className="block h-full rounded-full bg-fit-lime" style={{ width: `${(v.sets / maxSets) * 100}%` }} />
              </span>
              <span className="w-6 text-right font-semibold tabular-nums">{v.sets}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-fit-muted">Séries de músculos secundários contam como meia série.</p>
      </Card>
    </>
  );
}

function ProgramTab({ ctx }: { ctx: Awaited<ReturnType<typeof loadFitContext>> }) {
  const { week, answers, nextWeek } = ctx;
  const blocks = buildBlocks(week.goal, answers.level, week.totalWeeks);
  const total = week.totalWeeks;
  return (
    <>
      <Card>
        <SectionTitle>Linha do tempo</SectionTitle>
        <div className="relative">
          <div className="absolute bottom-0 top-0 w-px bg-fit-lime" style={{ left: `${((week.week - 0.5) / total) * 100}%` }}>
            <span className="absolute -top-5 -translate-x-1/2 rounded-full bg-fit-lime px-2 text-[10px] font-semibold text-fit-on-lime">hoje</span>
          </div>
          <ul className="space-y-3 pt-4">
            {blocks.map((b) => {
              const current = week.week >= b.fromWeek && week.week <= b.toWeek;
              return (
                <li key={b.index}>
                  <p className="mb-1 text-[11px] text-fit-muted">
                    Sem. {b.fromWeek}–{b.toWeek} · {PHASE_INFO[b.kind].label}
                  </p>
                  <div
                    className={`h-4 rounded-full ${current ? "bg-fit-lime" : week.week > b.toWeek ? "bg-fit-lime/40" : "bg-fit-strong"}`}
                    style={{ marginLeft: `${((b.fromWeek - 1) / total) * 100}%`, width: `${((b.toWeek - b.fromWeek + 1) / total) * 100}%` }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-4 flex gap-4 text-[11px] text-fit-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-fit-lime/40" /> concluído
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-fit-lime" /> atual
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-fit-strong ring-1 ring-fit-line" /> próximo
          </span>
        </div>
      </Card>

      <Card>
        <SectionTitle>Como funciona</SectionTitle>
        <ul className="space-y-2 text-sm text-fit-muted">
          <li>• Blocos de 4 semanas: 3 semanas progredindo carga + 1 de descarga.</li>
          <li>• Cada bloco muda o estímulo (faixa de repetições, descanso, volume).</li>
          <li>• Dentro do bloco, a reserva de repetições (RIR) cai semana a semana.</li>
          <li>• A cada nova bioimpedância o volume, o cardio e as calorias são recalculados.</li>
        </ul>
      </Card>

      {nextWeek && (
        <Card>
          <SectionTitle>Próxima semana</SectionTitle>
          <p className="text-sm">
            {PHASE_INFO[nextWeek.phase].label}
            {nextWeek.deload ? " · Descarga" : ""}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-fit-muted">
            {nextWeek.days.map((d) => (
              <li key={d.index}>
                {WEEKDAY_LONG[d.weekday]}: {d.title} · {d.exercises.length} exercícios · {d.focus.map((m) => MUSCLE_LABEL[m]).join(", ")}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-fit-card-2 py-2">
      <p className="text-sm font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-fit-muted">{label}</p>
    </div>
  );
}
