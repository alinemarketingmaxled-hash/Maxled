import Link from "next/link";
import { notFound } from "next/navigation";
import { EXERCISES, canDo, equipmentText, getExercise } from "@/lib/fit/exercises";
import { exerciseImages } from "@/lib/fit/exercise-images";
import { EQUIPMENT_LABEL, LIMITATION_LABEL, MUSCLE_LABEL, type Equipment } from "@/lib/fit/types";
import { WEEKDAY_LONG } from "@/lib/fit/program";
import { getFitProfile, requireFitAccount, loadFitContext } from "@/lib/fit/server";
import { Card, ExerciseMedia, PoseFrame, SectionTitle } from "@/components/fit/ui";
import { ExercisePrefButtons } from "@/components/fit/ExercisePrefButtons";
import { POSES } from "@/lib/fit/poses";
import { AlertI, ArrowLeftI, ChevronRightI } from "@/components/fit/FitIcons";

const LEVEL = ["", "Iniciante", "Intermediário", "Avançado"];

export default async function ExercicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = getExercise(id);
  if (!ex) notFound();
  const account = await requireFitAccount();
  const profile = await getFitProfile(account.id);
  const ctx = profile ? await loadFitContext() : null;
  const owned = new Set<Equipment>([...(profile?.answers.equipment ?? ["academia"]), "peso_corporal"]);
  const blockedBy = ex.avoid.filter((l) => profile?.answers.limitations.includes(l));
  const available = canDo(ex, owned);
  const img = exerciseImages(ex.id);
  const pose = POSES[ex.id];
  const inPlan = ctx?.week.days.filter((d) => d.exercises.some((p) => p.exerciseId === ex.id)) ?? [];
  const planned = inPlan[0]?.exercises.find((p) => p.exerciseId === ex.id);
  const similar = EXERCISES.filter((e) => e.pattern === ex.pattern && e.muscle === ex.muscle && e.id !== ex.id).slice(0, 6);

  return (
    <main className="flex flex-col gap-4 pt-4">
      <div className="relative">
        <ExerciseMedia id={ex.id} pattern={ex.pattern} size="lg" labels className="h-72" />
        <Link href="/fit/exercicios" aria-label="Voltar" className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-fit-strong text-white">
          <ArrowLeftI className="h-4 w-4" />
        </Link>
      </div>

      <div>
        <p className="text-xs text-fit-accent">{MUSCLE_LABEL[ex.muscle]}</p>
        <h1 className="text-2xl font-bold leading-tight">{ex.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-fit-card px-3 py-1.5">{LEVEL[ex.difficulty]}</span>
          <span className="rounded-full bg-fit-card px-3 py-1.5">{ex.compound ? "Multiarticular" : "Isolado"}</span>
          <span className="rounded-full bg-fit-card px-3 py-1.5">{ex.unit === "seg" ? "Por tempo" : "Por repetições"}</span>
          <span className={`rounded-full px-3 py-1.5 ${available ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card text-fit-muted"}`}>
            {available ? "Você tem o equipamento" : "Equipamento que você não marcou"}
          </span>
        </div>
      </div>

      {profile && (
        <ExercisePrefButtons
          exerciseId={ex.id}
          pref={profile.answers.excludedExercises.includes(ex.id) ? "excluir" : profile.answers.favoriteExercises.includes(ex.id) ? "manter" : "neutro"}
        />
      )}

      {blockedBy.length > 0 && (
        <Card className="flex gap-3 border border-fit-bad/40">
          <AlertI className="h-5 w-5 shrink-0 text-fit-bad" />
          <p className="text-sm">
            Não entra no seu treino por causa de: <b>{blockedBy.map((l) => LIMITATION_LABEL[l]).join(", ")}</b>. Converse com um profissional antes de fazer.
          </p>
        </Card>
      )}

      {!img && pose && (
        <div className="grid grid-cols-2 gap-2">
          {(["Posição inicial", "Posição final"] as const).map((label, i) => (
            <figure key={label} className="overflow-hidden rounded-3xl bg-fit-card">
              <PoseFrame pose={pose[i]} className="aspect-[3/2] w-full bg-[#1f2024]" />
              <figcaption className="px-3 py-2 text-center text-xs font-medium">
                {i + 1}. {label}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {img && (
        <div className="grid grid-cols-2 gap-2">
          {(["Posição inicial", "Posição final"] as const).map((label, i) => (
            <figure key={label} className="overflow-hidden rounded-3xl bg-fit-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- small static frames */}
              <img src={img.frames[i]} alt={`${ex.name}: ${label.toLowerCase()}`} className="aspect-[3/2] w-full object-cover" loading="lazy" />
              <figcaption className="px-3 py-2 text-center text-xs font-medium">
                {i + 1}. {label}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Card>
        <SectionTitle>Como fazer</SectionTitle>
        <ol className="space-y-3">
          {ex.cues.map((c, i) => (
            <li key={c} className="flex gap-3 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fit-lime text-xs font-bold text-fit-on-lime">{i + 1}</span>
              <span className="pt-1">{c}</span>
            </li>
          ))}
          <li className="flex gap-3 text-sm text-fit-muted">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fit-card-2 text-xs font-bold">{ex.cues.length + 1}</span>
            <span className="pt-1">Respire: solte o ar na fase de esforço e puxe na volta. Movimento controlado, sem tranco.</span>
          </li>
        </ol>
      </Card>

      <Card>
        <SectionTitle>Detalhes</SectionTitle>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-fit-muted">Equipamento</dt>
            <dd className="text-right">{equipmentText(ex, EQUIPMENT_LABEL)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fit-muted">Músculo principal</dt>
            <dd>{MUSCLE_LABEL[ex.muscle]}</dd>
          </div>
          {ex.secondary.length > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-fit-muted">Também trabalha</dt>
              <dd className="text-right">{ex.secondary.map((m) => MUSCLE_LABEL[m]).join(", ")}</dd>
            </div>
          )}
          {planned && (
            <div className="flex justify-between gap-4">
              <dt className="text-fit-muted">No seu treino</dt>
              <dd className="text-right">
                {planned.sets} × {planned.reps} · {inPlan.map((d) => WEEKDAY_LONG[d.weekday]).join(", ")}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {similar.length > 0 && (
        <Card>
          <SectionTitle>Variações</SectionTitle>
          <ul className="space-y-2">
            {similar.map((s) => (
              <li key={s.id}>
                <Link href={`/fit/exercicios/${s.id}`} className="flex items-center gap-3 rounded-2xl bg-fit-card-2 p-2">
                  <ExerciseMedia id={s.id} pattern={s.pattern} size="sm" />
                  <span className="flex-1 text-sm font-medium">{s.name}</span>
                  <ChevronRightI className="h-4 w-4 text-fit-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {img && <p className="text-center text-[10px] text-fit-faint">Fotos: Free Exercise DB (domínio público).</p>}
    </main>
  );
}
