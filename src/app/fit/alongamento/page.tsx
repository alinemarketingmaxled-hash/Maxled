import Link from "next/link";
import { loadFitContext } from "@/lib/fit/server";
import { STRETCHES, REGION_LABEL, type StretchRegion } from "@/lib/fit/stretches";
import { weekdayIndex } from "@/lib/fit/time";
import { WEEKDAY_LONG } from "@/lib/fit/program";
import { Card, SectionTitle, TopBar } from "@/components/fit/ui";
import { StretchList, getStretches, toSessionItems, totalMinutes } from "@/components/fit/StretchList";
import { GuidedStretch } from "@/components/fit/GuidedStretch";

const REGIONS: StretchRegion[] = ["pescoco", "ombros", "peito", "costas", "biceps", "triceps", "punho", "core", "lombar", "quadril", "gluteos", "adutores", "quadriceps", "posterior", "panturrilha", "tornozelo"];

export default async function AlongamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; tipo?: string; lista?: string; regiao?: string }>;
}) {
  const { dia, tipo, lista, regiao } = await searchParams;
  const ctx = await loadFitContext();
  const limits = new Set(ctx.answers.limitations);

  // Guided mode for one day's warm-up or cool-down.
  const guidedDay = dia != null && /^\d+$/.test(dia) ? ctx.week.days[Number(dia)] : undefined;
  if (guidedDay && (tipo === "antes" || tipo === "depois")) {
    const items = getStretches(tipo === "antes" ? guidedDay.stretchesBefore : guidedDay.stretchesAfter);
    return (
      <GuidedStretch
        title={`${tipo === "antes" ? "Aquecimento" : "Volta à calma"} · ${guidedDay.title}`}
        items={toSessionItems(items)}
        backHref={`/fit/treino/${guidedDay.index}`}
      />
    );
  }

  const today = weekdayIndex();
  const day = ctx.week.days.find((d) => d.weekday === today) ?? ctx.week.days.find((d) => d.weekday > today) ?? ctx.week.days[0];
  const before = getStretches(day.stretchesBefore);
  const after = getStretches(day.stretchesAfter);
  const kind = lista === "depois" ? "estatico" : "dinamico";
  const region = REGIONS.includes(regiao as StretchRegion) ? (regiao as StretchRegion) : null;
  const all = STRETCHES.filter((s) => s.kind === kind && (!region || s.regions.includes(region)) && !s.avoid.some((l) => limits.has(l)));
  const q = (next: { lista?: string; regiao?: string | null }) => {
    const p = new URLSearchParams();
    const l = next.lista ?? (kind === "estatico" ? "depois" : "antes");
    p.set("lista", l);
    const r = next.regiao === undefined ? region : next.regiao;
    if (r) p.set("regiao", r);
    return `/fit/alongamento?${p.toString()}`;
  };

  return (
    <main className="flex flex-col gap-4">
      <TopBar title="Alongamento" back="/fit/treino" />

      <Card tone="lime">
        <p className="text-xs font-semibold opacity-70">
          {day.weekday === today ? "Treino de hoje" : `Próximo treino · ${WEEKDAY_LONG[day.weekday]}`}
        </p>
        <h2 className="mt-1 text-2xl font-bold">{day.title}</h2>
        <p className="mt-1 text-sm opacity-80">
          Antes: {before.length} alongamentos dinâmicos (~{totalMinutes(before)} min). Depois: {after.length} estáticos (~{totalMinutes(after)} min).
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/fit/alongamento?dia=${day.index}&tipo=antes`} className="flex h-12 items-center justify-center rounded-full bg-fit-strong text-sm font-semibold text-[#d6f94b]">
            Aquecer agora
          </Link>
          <Link href={`/fit/alongamento?dia=${day.index}&tipo=depois`} className="flex h-12 items-center justify-center rounded-full bg-black/10 text-sm font-semibold">
            Alongar depois
          </Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>Antes de começar o treino</SectionTitle>
        <p className="-mt-1 mb-3 text-xs text-fit-muted">
          Dinâmicos, em movimento: aquecem as articulações sem tirar força. Evite segurar alongamentos longos antes de treinar pesado.
        </p>
        <StretchList items={before} />
      </Card>

      <Card>
        <SectionTitle>Todos os alongamentos</SectionTitle>
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-full bg-fit-card-2 p-1">
          <Link href={q({ lista: "antes" })} className={`rounded-full py-2 text-center text-xs font-medium ${kind === "dinamico" ? "bg-fit-lime text-fit-on-lime" : "text-fit-muted"}`}>
            Antes do treino
          </Link>
          <Link href={q({ lista: "depois" })} className={`rounded-full py-2 text-center text-xs font-medium ${kind === "estatico" ? "bg-fit-lime text-fit-on-lime" : "text-fit-muted"}`}>
            Depois do treino
          </Link>
        </div>
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1">
          <Link href={q({ regiao: null })} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${!region ? "border-fit-lime text-fit-accent" : "border-fit-line text-fit-muted"}`}>
            Todas as regiões
          </Link>
          {REGIONS.map((r) => (
            <Link key={r} href={q({ regiao: r })} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${region === r ? "border-fit-lime text-fit-accent" : "border-fit-line text-fit-muted"}`}>
              {REGION_LABEL[r]}
            </Link>
          ))}
        </div>
        {all.length ? <StretchList items={all} /> : <p className="text-sm text-fit-muted">Nenhum alongamento para essa região nesta lista.</p>}
      </Card>
      <p className="text-center text-[10px] text-fit-faint">Fotos: Free Exercise DB (domínio público).</p>
    </main>
  );
}
