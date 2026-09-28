import Link from "next/link";
import { loadFitContext } from "@/lib/fit/server";
import { PHASE_INFO, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/fit/program";
import { dayKey, mondayKey, weekdayIndex } from "@/lib/fit/time";
import { GOAL_LABEL, MUSCLE_LABEL } from "@/lib/fit/types";
import { Card, ProgressBar, Rings, SectionTitle, SeeAll, fmtDate, fmtNum } from "@/components/fit/ui";
import { CheckI, ChevronRightI, ClockI, DumbbellI, FlameI, PlayI, ScaleI, TrophyI } from "@/components/fit/FitIcons";

export default async function FitHome() {
  const ctx = await loadFitContext();
  const { answers, week, analysis, nutrition, logs, streak } = ctx;
  const today = weekdayIndex();

  const monday = mondayKey();
  const doneThisWeek = new Set(logs.filter((l) => dayKey(l.performedAt) >= monday).map((l) => weekdayIndex(l.performedAt)));
  const todayPlan = week.days.find((d) => d.weekday === today) ?? null;
  const todayDone = doneThisWeek.has(today);
  const nextPlan = week.days.find((d) => d.weekday > today) ?? week.days[0];
  const weekPct = week.days.length ? doneThisWeek.size / week.days.length : 0;
  const blockPct = (week.week - week.block.fromWeek + 1) / (week.block.toWeek - week.block.fromWeek + 1);
  const progress = analysis.progress;
  const reasons = analysis.adjustments.reasons.slice(0, 2);
  const hour = new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
  const greet = Number(hour) < 12 ? "Bom dia" : Number(hour) < 18 ? "Boa tarde" : "Boa noite";

  return (
    <main className="flex flex-col gap-4 pt-5">
      <header className="flex items-center gap-3">
        <div className="relative grid h-12 w-12 place-items-center rounded-full bg-fit-lime text-lg font-bold text-fit-on-lime">
          {answers.name.slice(0, 1).toUpperCase()}
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-fit-bg bg-fit-good" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">Olá, {answers.name.split(" ")[0]}!</p>
          <p className="text-xs text-fit-muted">{greet}, vamos começar o seu dia</p>
        </div>
        <Link href="/fit/perfil#conquistas" aria-label="Conquistas" className="grid h-11 w-11 place-items-center rounded-full bg-fit-card text-fit-accent">
          <TrophyI className="h-5 w-5" />
        </Link>
      </header>

      {/* Meta semanal — círculos dos dias */}
      <Card tone="strong">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Meta da semana</h2>
          <span className="rounded-full bg-[#d6f94b] px-3 py-1 text-xs font-semibold text-[#111214]">
            {doneThisWeek.size}/{week.days.length} treinos
          </span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => {
            const planned = ctx.weekdays.includes(i);
            const done = doneThisWeek.has(i);
            const isToday = i === today;
            return (
              <div key={d} className={`flex flex-col items-center gap-1.5 rounded-full py-2 ${planned ? "bg-[#d6f94b]/90" : "bg-white/10"}`}>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 ${
                    done ? "border-[#111214] bg-[#111214] text-[#d6f94b]" : planned ? "border-[#111214]/40 bg-transparent" : "border-white/20"
                  } ${isToday ? "ring-2 ring-white" : ""}`}
                >
                  {done ? <CheckI className="h-4 w-4" strokeWidth={3} /> : planned ? <DumbbellI className="h-3.5 w-3.5 text-[#111214]/60" /> : null}
                </span>
                <span className={`text-[10px] font-semibold ${planned ? "text-[#111214]" : "text-white/50"}`}>{d}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card tone="lime" className="flex flex-col justify-between">
          <p className="text-xs font-semibold opacity-70">Fase atual</p>
          <div>
            <p className="text-2xl font-bold leading-tight">{PHASE_INFO[week.phase].label}</p>
            <p className="text-xs opacity-70">
              Semana {week.week} de {week.totalWeeks}
              {week.deload ? " · descarga" : ""}
            </p>
          </div>
        </Card>
        <Card className="relative overflow-hidden">
          <FlameI className="absolute -bottom-3 -right-3 h-20 w-20 text-fit-accent/20" />
          <p className="text-4xl font-bold tabular-nums">{streak}</p>
          <p className="text-xs text-fit-muted">{streak === 1 ? "dia de sequência" : "dias de sequência"}</p>
        </Card>
      </div>

      {/* Treino de hoje */}
      <Card flush className="relative overflow-hidden">
        <div
          className="p-5"
          style={{
            background:
              "radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--fit-lime) 30%, transparent), transparent 55%)",
          }}
        >
          <p className="text-xs font-medium text-fit-accent">{todayPlan ? (todayDone ? "Concluído hoje" : "Treino de hoje") : "Hoje é dia de descanso"}</p>
          <h2 className="mt-1 text-2xl font-bold leading-tight">{todayPlan ? todayPlan.title : `Próximo: ${nextPlan.title}`}</h2>
          <p className="mt-1 text-xs text-fit-muted">
            {todayPlan
              ? todayPlan.focus.map((m) => MUSCLE_LABEL[m]).join(" · ")
              : `${WEEKDAY_LONG[nextPlan.weekday]} · descanse, hidrate e durma bem`}
          </p>
          {(todayPlan ?? nextPlan) && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="flex items-center gap-1 rounded-full bg-fit-card-2 px-3 py-1.5 text-xs">
                <ClockI className="h-3.5 w-3.5" /> {(todayPlan ?? nextPlan).estMinutes} min
              </span>
              <span className="flex items-center gap-1 rounded-full bg-fit-card-2 px-3 py-1.5 text-xs">
                <FlameI className="h-3.5 w-3.5" /> {(todayPlan ?? nextPlan).estKcal} kcal
              </span>
              <span className="flex items-center gap-1 rounded-full bg-fit-card-2 px-3 py-1.5 text-xs">
                <DumbbellI className="h-3.5 w-3.5" /> {(todayPlan ?? nextPlan).exercises.length} exercícios
              </span>
            </div>
          )}
          <Link
            href={`/fit/treino/${(todayPlan ?? nextPlan).index}`}
            className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-fit-lime font-semibold text-fit-on-lime"
          >
            <PlayI className="h-4 w-4" /> {todayPlan && !todayDone ? "Começar treino" : "Ver treino"}
          </Link>
        </div>
      </Card>

      {/* Atividade: anéis */}
      <Card>
        <SectionTitle action={<SeeAll href="/fit/bio">Ver evolução</SeeAll>}>Seu progresso</SectionTitle>
        <div className="flex items-center gap-5">
          <div className="flex-1 space-y-3">
            <Legend label="Treinos na semana" value={`${doneThisWeek.size}`} total={`/ ${week.days.length}`} />
            <Legend label="Meta final" value={progress ? `${progress.pct}` : "–"} total="%" />
            <Legend label="Bloco atual" value={`${week.week - week.block.fromWeek + 1}`} total={`/ ${week.block.toWeek - week.block.fromWeek + 1} sem`} />
          </div>
          <Rings values={[weekPct, (progress?.pct ?? 0) / 100, blockPct]} />
        </div>
      </Card>

      {/* Meta */}
      <Card>
        <SectionTitle action={<SeeAll href="/fit/bio">Bio</SeeAll>}>Objetivo: {GOAL_LABEL[week.goal]}</SectionTitle>
        {progress ? (
          <>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold tabular-nums">
                {fmtNum(progress.current)}
                <span className="text-sm font-medium text-fit-muted">{progress.metric === "gordura" ? "%" : " kg"}</span>
              </p>
              <p className="text-right text-xs text-fit-muted">
                meta {fmtNum(progress.target)}
                {progress.metric === "gordura" ? "%" : " kg"}
                <br />
                {progress.metric === "gordura" ? "de gordura" : progress.metric === "peso" ? "de peso" : "de massa magra"}
              </p>
            </div>
            <ProgressBar pct={progress.pct} className="mt-3" />
            <p className="mt-2 text-xs text-fit-muted">
              {progress.reached
                ? "Meta alcançada! O programa já mudou de fase."
                : progress.etaDate
                  ? `No ritmo atual você chega lá por volta de ${fmtDate(progress.etaDate, { month: "long", year: "numeric" })}.`
                  : `${progress.pct}% do caminho desde a primeira bio.`}
            </p>
          </>
        ) : (
          <Link href="/fit/bio/nova?modo=laudo" className="flex items-center gap-3 rounded-2xl bg-fit-card-2 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-fit-lime text-fit-on-lime">
              <ScaleI className="h-5 w-5" />
            </span>
            <span className="flex-1 text-sm">
              Adicione sua bioimpedância para acompanhar a meta
              <span className="block text-xs text-fit-muted">Foto do laudo, foto do corpo ou manual</span>
            </span>
            <ChevronRightI className="h-4 w-4 text-fit-muted" />
          </Link>
        )}
      </Card>

      {reasons.length > 0 && (
        <Card>
          <SectionTitle action={<SeeAll href="/fit/bio#ajustes">Detalhes</SeeAll>}>Ajustes no seu treino</SectionTitle>
          <ul className="space-y-2">
            {reasons.map((r) => (
              <li key={r.title} className="flex gap-3 rounded-2xl bg-fit-card-2 p-3">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${r.tone === "good" ? "bg-fit-good" : r.tone === "warn" ? "bg-fit-warn" : "bg-fit-info"}`} />
                <span>
                  <span className="block text-sm font-semibold">{r.title}</span>
                  <span className="block text-xs text-fit-muted">{r.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle action={<SeeAll href="/fit/perfil#nutricao">Plano</SeeAll>}>Nutrição do dia</SectionTitle>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Macro label="kcal" value={nutrition.kcal} />
          <Macro label="Proteína" value={`${nutrition.proteinG}g`} />
          <Macro label="Carbo" value={`${nutrition.carbG}g`} />
          <Macro label="Água" value={`${fmtNum(nutrition.waterL)}L`} />
        </div>
      </Card>

      <Card>
        <SectionTitle action={<SeeAll href="/fit/treino#historico">Ver tudo</SeeAll>}>Últimos treinos</SectionTitle>
        {logs.length === 0 ? (
          <p className="text-sm text-fit-muted">Nenhum treino registrado ainda. O primeiro é o mais importante!</p>
        ) : (
          <ul className="space-y-2">
            {logs.slice(0, 3).map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-fit-card-2 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-fit-lime text-fit-on-lime">
                  <DumbbellI className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.title}</span>
                  <span className="block text-xs text-fit-muted">
                    {l.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)} séries
                    {l.durationMin ? ` · ${l.durationMin} min` : ""}
                  </span>
                </span>
                <span className="text-xs text-fit-muted">{fmtDate(l.performedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

function Legend({ label, value, total }: { label: string; value: string; total: string }) {
  return (
    <div>
      <p className="text-xs text-fit-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums text-fit-accent">
        {value}
        <span className="ml-1 text-xs font-medium text-fit-muted">{total}</span>
      </p>
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-fit-card-2 px-1 py-3">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-fit-muted">{label}</p>
    </div>
  );
}
