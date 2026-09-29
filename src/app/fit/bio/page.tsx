import Link from "next/link";
import { loadFitContext } from "@/lib/fit/server";
import { TREND_LABEL, bmi, bmiLabel, bodyFatBand, defaultTargetBodyFat, fatMassKg, leanMassKg, waistHipRatio } from "@/lib/fit/bio";
import { GOAL_LABEL } from "@/lib/fit/types";
import { Card, LineChart, ProgressBar, SectionTitle, TopBar, fmtDate, fmtNum, signed } from "@/components/fit/ui";
import { CameraI, CheckI, FileI, PencilI, PlusI, ScaleI, UserI } from "@/components/fit/FitIcons";
import { DeleteBioButton } from "@/components/fit/DeleteButtons";

const SOURCE_LABEL = { manual: "Manual", laudo: "Laudo", foto: "Foto" } as const;

export default async function BioPage({ searchParams }: { searchParams: Promise<{ atualizado?: string }> }) {
  const { atualizado } = await searchParams;
  const ctx = await loadFitContext();
  const { bios, analysis, answers, week, nutrition } = ctx;
  const { latest, delta, trend, progress, adjustments } = analysis;
  const addButton = (
    <Link href="/fit/bio/nova" aria-label="Nova bioimpedância" className="grid h-9 w-9 place-items-center rounded-full bg-fit-lime text-fit-on-lime">
      <PlusI className="h-4 w-4" />
    </Link>
  );

  if (!latest) {
    return (
      <main className="flex flex-col gap-4">
        <TopBar title="Bioimpedância" right={addButton} />
        <Card tone="lime">
          <ScaleI className="h-10 w-10" />
          <h2 className="mt-3 text-2xl font-bold">Seu treino se adapta ao seu corpo</h2>
          <p className="mt-2 text-sm opacity-75">
            Registre sua bioimpedância. Cada nova medição é comparada com a anterior e com a sua meta final, e o treino, o cardio e as calorias são recalculados automaticamente.
          </p>
        </Card>
        <EntryOptions />
      </main>
    );
  }

  const band = latest.bodyFatPct != null ? bodyFatBand(latest.bodyFatPct, answers.sex) : null;
  const bmiV = bmi(latest.weightKg, answers.heightCm);
  const whr = waistHipRatio(latest);
  const series = (fn: (b: (typeof bios)[number]) => number | null) =>
    bios.filter((b) => fn(b) != null).map((b) => ({ x: fmtDate(b.measuredAt), y: Math.round(fn(b)! * 10) / 10 }));
  const targetBf = answers.targetBodyFatPct ?? defaultTargetBodyFat(answers);
  const toneClass = (good: boolean | null) => (good == null ? "" : good ? "text-fit-good" : "text-fit-bad");
  const cutting = answers.goal === "emagrecimento" || answers.goal === "recomposicao";

  return (
    <main className="flex flex-col gap-4">
      <TopBar title="Bioimpedância" right={addButton} />

      {atualizado === "1" && (
        <Card tone="lime" className="fit-pop">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-fit-strong text-[#d6f94b]">
              <CheckI className="h-5 w-5" strokeWidth={3} />
            </span>
            <div>
              <p className="font-bold">Bio registrada, treino recalculado!</p>
              <p className="text-xs opacity-75">Veja abaixo o que mudou e por quê.</p>
            </div>
          </div>
        </Card>
      )}

      <Card tone="strong">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Última medição · {fmtDate(latest.measuredAt, { day: "2-digit", month: "long" })}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5">{SOURCE_LABEL[latest.source]}</span>
        </div>
        {latest.hasImage && (
          <Link href={`/fit/bio/${latest.id}`} className="mt-3 flex items-center gap-3 rounded-2xl bg-white/10 p-2 pr-3 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route */}
            <img src={`/fit/bio/${latest.id}/imagem`} alt="" className="h-12 w-12 rounded-xl object-cover" />
            <span className="flex-1">Ver print do laudo</span>
            <span className="text-[#d6f94b]">Abrir</span>
          </Link>
        )}
        <div className="mt-3 flex items-end gap-6">
          <div>
            <p className="text-5xl font-bold tabular-nums">{fmtNum(latest.weightKg)}</p>
            <p className="text-xs text-white/60">kg</p>
          </div>
          {latest.bodyFatPct != null && (
            <div>
              <p className="text-5xl font-bold tabular-nums text-[#d6f94b]">{fmtNum(latest.bodyFatPct)}</p>
              <p className="text-xs text-white/60">% gordura</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          {band && <span className="rounded-full bg-[#d6f94b] px-3 py-1 font-semibold text-[#111214]">{band.label}</span>}
          <span className="rounded-full bg-white/10 px-3 py-1">
            IMC {fmtNum(bmiV)} · {bmiLabel(bmiV)}
          </span>
          {whr != null && <span className="rounded-full bg-white/10 px-3 py-1">Cintura/quadril {whr}</span>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Massa magra" value={fmtNum(leanMassKg(latest))} unit="kg" />
          <Metric label="Gordura" value={fmtNum(fatMassKg(latest))} unit="kg" />
          <Metric label="Músculo" value={fmtNum(latest.muscleMassKg)} unit="kg" />
          <Metric label="Visceral" value={fmtNum(latest.visceralFat)} unit="" />
          <Metric label="Água" value={fmtNum(latest.waterPct)} unit="%" />
          <Metric label="Basal" value={fmtNum(latest.bmrKcal ?? nutrition.bmr, 0)} unit="kcal" />
        </div>
      </Card>

      {delta && (
        <Card>
          <SectionTitle>Desde a bio anterior</SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-fit-muted">
            {delta.days} dias · <span className="text-fit-ink">{TREND_LABEL[trend]}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <DeltaBox label="Peso" value={signed(delta.weightKg, " kg")} className={toneClass(answers.goal === "hipertrofia" ? delta.weightKg >= 0 : delta.weightKg <= 0)} />
            <DeltaBox label="Gordura" value={signed(delta.fatKg, " kg")} className={toneClass(delta.fatKg == null ? null : delta.fatKg <= 0 || !cutting)} />
            <DeltaBox label="Massa magra" value={signed(delta.leanKg, " kg")} className={toneClass(delta.leanKg == null ? null : delta.leanKg >= 0)} />
            <DeltaBox label="% gordura" value={signed(delta.bodyFatPct, " pp")} className={toneClass(delta.bodyFatPct == null ? null : delta.bodyFatPct <= 0)} />
            {delta.waistCm != null && <DeltaBox label="Cintura" value={signed(delta.waistCm, " cm")} className={toneClass(delta.waistCm <= 0)} />}
          </div>
        </Card>
      )}

      {progress && (
        <Card>
          <SectionTitle>Meta final</SectionTitle>
          <div className="flex items-center justify-between text-xs text-fit-muted">
            <span>
              Início {fmtNum(progress.start)}
              {progress.metric === "gordura" ? "%" : " kg"}
            </span>
            <span className="text-base font-bold text-fit-accent">{progress.pct}%</span>
            <span>
              Meta {fmtNum(progress.target)}
              {progress.metric === "gordura" ? "%" : " kg"}
            </span>
          </div>
          <ProgressBar pct={progress.pct} className="mt-2" />
          <p className="mt-2 text-xs text-fit-muted">
            {progress.reached
              ? "Meta atingida! O programa entrou na próxima fase."
              : progress.etaDate
                ? `Previsão no ritmo atual: ${fmtDate(progress.etaDate, { month: "long", year: "numeric" })}.`
                : "Registre novas bios para calcular a previsão."}
          </p>
        </Card>
      )}

      <section id="ajustes">
        <Card>
          <SectionTitle>Como seu treino mudou</SectionTitle>
          <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
            <Knob label="Objetivo programado" value={GOAL_LABEL[week.goal]} changed={!!adjustments.goalOverride} />
            <Knob label="Volume" value={`${Math.round(adjustments.volume * 100)}%`} changed={adjustments.volume !== 1} />
            <Knob label="Cardio extra" value={`+${adjustments.cardioMinutes} min`} changed={adjustments.cardioMinutes > 0} />
            <Knob label="Calorias" value={`${nutrition.kcal} kcal`} changed={adjustments.kcalDelta !== 0} hint={adjustments.kcalDelta ? signed(adjustments.kcalDelta) : undefined} />
            <Knob label="Faixa de reps" value={adjustments.repShift < 0 ? "Mais pesada" : adjustments.repShift > 0 ? "Mais leve" : "Padrão"} changed={adjustments.repShift !== 0} />
            <Knob label="Descanso" value={adjustments.density ? "Mais curto" : "Padrão"} changed={adjustments.density} />
          </div>
          <ul className="space-y-2">
            {adjustments.reasons.map((r) => (
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
      </section>

      <Card>
        <SectionTitle>Peso</SectionTitle>
        <LineChart points={series((b) => b.weightKg)} unit=" kg" goal={answers.targetWeightKg} />
      </Card>
      <Card>
        <SectionTitle>% de gordura</SectionTitle>
        <LineChart points={series((b) => b.bodyFatPct)} unit="%" goal={targetBf} />
      </Card>
      <Card>
        <SectionTitle>Massa magra</SectionTitle>
        <LineChart points={series((b) => leanMassKg(b))} unit=" kg" />
      </Card>
      {bios.some((b) => b.waistCm != null) && (
        <Card>
          <SectionTitle>Cintura</SectionTitle>
          <LineChart points={series((b) => b.waistCm)} unit=" cm" />
        </Card>
      )}

      <Card>
        <SectionTitle>Histórico</SectionTitle>
        <ul className="space-y-2">
          {[...bios].reverse().map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-fit-card-2 p-3">
              <Link href={`/fit/bio/${b.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {b.hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route
                  <img src={`/fit/bio/${b.id}/imagem`} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-fit-card object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-fit-card text-fit-accent">
                    {b.source === "laudo" ? <FileI className="h-5 w-5" /> : b.source === "foto" ? <CameraI className="h-5 w-5" /> : <PencilI className="h-5 w-5" />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {fmtNum(b.weightKg)} kg{b.bodyFatPct != null ? ` · ${fmtNum(b.bodyFatPct)}%` : ""}
                  </span>
                  <span className="block text-xs text-fit-muted">
                    {fmtDate(b.measuredAt, { day: "2-digit", month: "short", year: "numeric" })} · {SOURCE_LABEL[b.source]}
                    {b.hasImage ? " · com print" : ""}
                  </span>
                </span>
              </Link>
              <DeleteBioButton id={b.id} />
            </li>
          ))}
        </ul>
      </Card>

      <EntryOptions />
    </main>
  );
}

function EntryOptions() {
  const opts = [
    { href: "/fit/bio/nova?modo=laudo", icon: FileI, title: "Foto do laudo", hint: "A IA lê os números do laudo" },
    { href: "/fit/bio/nova?modo=foto", icon: UserI, title: "Foto do corpo", hint: "Estimativa visual de % de gordura" },
    { href: "/fit/bio/nova?modo=manual", icon: PencilI, title: "Digitar valores", hint: "Peso, gordura, músculo e medidas" },
  ];
  return (
    <div className="grid gap-2">
      {opts.map((o) => (
        <Link key={o.href} href={o.href} className="flex items-center gap-3 rounded-3xl bg-fit-card p-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-fit-lime text-fit-on-lime">
            <o.icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">{o.title}</span>
            <span className="block text-xs text-fit-muted">{o.hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-white/5 py-2.5">
      <p className="text-base font-bold tabular-nums">
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-white/50">{unit}</span>
      </p>
      <p className="text-[10px] text-white/50">{label}</p>
    </div>
  );
}

function DeltaBox({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-2xl bg-fit-card-2 p-3">
      <p className="text-[11px] text-fit-muted">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  );
}

function Knob({ label, value, changed, hint }: { label: string; value: string; changed: boolean; hint?: string }) {
  return (
    <div className={`rounded-2xl p-3 ${changed ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card-2"}`}>
      <p className={`text-[10px] ${changed ? "opacity-70" : "text-fit-muted"}`}>{label}</p>
      <p className="text-sm font-bold">{value}</p>
      {hint && <p className="text-[10px] opacity-70">{hint} kcal</p>}
    </div>
  );
}
