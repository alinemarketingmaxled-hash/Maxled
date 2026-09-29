import Link from "next/link";
import { cookies } from "next/headers";
import { loadFitContext } from "@/lib/fit/server";
import { EQUIPMENT_LABEL, GOAL_LABEL, LEVEL_LABEL, LIMITATION_LABEL, MUSCLE_LABEL, TIME_LABEL, ageFrom } from "@/lib/fit/types";
import { Card, ExerciseMedia, SectionTitle, TopBar, fmtDate, fmtNum } from "@/components/fit/ui";
import { ExercisePrefButtons } from "@/components/fit/ExercisePrefButtons";
import { getExercise } from "@/lib/fit/exercises";
import { ChevronRightI, DumbbellI, FlameI, HeartI, PencilI, ScaleI, StarI, TrophyI } from "@/components/fit/FitIcons";
import { ThemeToggle } from "@/components/fit/ThemeToggle";
import { signOutFitAction } from "@/app/fit/actions";

const BADGE_ICON = { flame: FlameI, trophy: TrophyI, dumbbell: DumbbellI, scale: ScaleI, heart: HeartI, star: StarI };

export default async function PerfilPage() {
  const ctx = await loadFitContext();
  const { answers, nutrition, achievements, logs, bios, startedAt, week } = ctx;
  const theme = (await cookies()).get("fit-theme")?.value === "light" ? "light" : "dark";
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const macroKcal = nutrition.proteinG * 4 + nutrition.fatG * 9 + nutrition.carbG * 4;

  return (
    <main className="flex flex-col gap-4">
      <TopBar title="Perfil" />

      <Card className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-fit-lime text-2xl font-bold text-fit-on-lime">{answers.name.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{answers.name}</p>
          <p className="text-xs text-fit-accent">
            {GOAL_LABEL[answers.goal]} · {LEVEL_LABEL[answers.level]}
          </p>
          <p className="text-xs text-fit-muted">Desde {fmtDate(startedAt, { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Card flush className="p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-fit-accent">{logs.length}</p>
          <p className="text-[11px] text-fit-muted">treinos</p>
        </Card>
        <Card flush className="p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-fit-accent">{bios.length}</p>
          <p className="text-[11px] text-fit-muted">bios</p>
        </Card>
        <Card flush className="p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-fit-accent">
            {week.week}/{week.totalWeeks}
          </p>
          <p className="text-[11px] text-fit-muted">semanas</p>
        </Card>
      </div>

      <section id="nutricao">
        <Card>
          <SectionTitle>Nutrição</SectionTitle>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold tabular-nums">{nutrition.kcal}</p>
              <p className="text-xs text-fit-muted">kcal por dia</p>
            </div>
            <div className="text-right text-xs text-fit-muted">
              <p>Gasto total: {nutrition.tdee} kcal</p>
              <p>Basal: {nutrition.bmr} kcal</p>
              <p className="text-[10px]">({nutrition.bmrMethod})</p>
            </div>
          </div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            <span className="bg-fit-lime" style={{ width: `${((nutrition.proteinG * 4) / macroKcal) * 100}%` }} />
            <span className="bg-fit-info" style={{ width: `${((nutrition.carbG * 4) / macroKcal) * 100}%` }} />
            <span className="bg-fit-warn" style={{ width: `${((nutrition.fatG * 9) / macroKcal) * 100}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            <Macro color="bg-fit-lime" label="Proteína" value={`${nutrition.proteinG}g`} />
            <Macro color="bg-fit-info" label="Carbo" value={`${nutrition.carbG}g`} />
            <Macro color="bg-fit-warn" label="Gordura" value={`${nutrition.fatG}g`} />
            <Macro color="bg-fit-card-3" label="Água" value={`${fmtNum(nutrition.waterL)}L`} />
          </div>
          <p className="mt-3 text-[11px] text-fit-faint">Estimativas para orientação. Para um plano alimentar completo, consulte um nutricionista.</p>
        </Card>
      </section>

      <section id="conquistas">
        <Card>
          <SectionTitle>
            Conquistas{" "}
            <span className="text-xs font-normal text-fit-muted">
              {unlocked}/{achievements.length}
            </span>
          </SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {achievements.map((a) => {
              const Icon = BADGE_ICON[a.icon];
              return (
                <div key={a.id} className="flex flex-col items-center gap-1.5 text-center" title={a.detail}>
                  <span
                    className={`grid h-16 w-16 place-items-center rounded-[22px] ${
                      a.unlocked ? "bg-fit-lime text-fit-on-lime shadow-lg shadow-black/20" : "bg-fit-card-2 text-fit-faint grayscale"
                    }`}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className={`text-[11px] leading-tight ${a.unlocked ? "font-medium" : "text-fit-faint"}`}>{a.title}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <Card>
        <SectionTitle
          action={
            <Link href="/fit/comecar" className="flex items-center gap-1 text-xs font-medium text-fit-accent">
              <PencilI className="h-3.5 w-3.5" /> Editar
            </Link>
          }
        >
          Minhas respostas
        </SectionTitle>
        <dl className="divide-y divide-fit-line text-sm">
          <Row k="Idade / altura" v={`${ageFrom(answers)} anos · ${answers.heightCm} cm`} />
          <Row
            k="Meta"
            v={[answers.targetWeightKg ? `${answers.targetWeightKg} kg` : null, answers.targetBodyFatPct ? `${answers.targetBodyFatPct}%` : null].filter(Boolean).join(" · ") || "Automática"}
          />
          <Row k="Período" v={`${answers.programWeeks} semanas`} />
          <Row k="Rotina" v={`${answers.daysPerWeek}x · ${answers.sessionMinutes} min · ${TIME_LABEL[answers.timeOfDay]}`} />
          <Row k="Equipamentos" v={answers.equipment.map((e) => EQUIPMENT_LABEL[e]).join(", ") || "Peso corporal"} />
          <Row k="Limitações" v={answers.limitations.map((l) => LIMITATION_LABEL[l]).join(", ") || "Nenhuma"} />
          <Row k="Foco" v={answers.focusMuscles.map((m) => MUSCLE_LABEL[m]).join(", ") || "Equilibrado"} />
          <Row k="Sono / estresse" v={`${answers.sleepHours}h · ${answers.stressLevel}/5`} />
        </dl>
      </Card>

      <Card>
        <SectionTitle>Seus exercícios</SectionTitle>
        {answers.excludedExercises.length === 0 && answers.favoriteExercises.length === 0 ? (
          <p className="text-sm text-fit-muted">
            Nenhuma preferência ainda. No treino do dia, toque num exercício e use &quot;Manter sempre&quot; ou &quot;Não quero este&quot;.
          </p>
        ) : (
          <div className="space-y-4">
            {(
              [
                ["Mantidos no treino", answers.favoriteExercises, "manter"],
                ["Fora do treino", answers.excludedExercises, "excluir"],
              ] as const
            ).map(([label, ids, pref]) =>
              ids.length ? (
                <div key={label}>
                  <p className="mb-2 text-xs font-medium text-fit-muted">{label}</p>
                  <ul className="space-y-2">
                    {ids.map((id) => {
                      const ex = getExercise(id);
                      if (!ex) return null;
                      return (
                        <li key={id} className="rounded-2xl bg-fit-card-2 p-3">
                          <Link href={`/fit/exercicios/${id}`} className="mb-2 flex items-center gap-3">
                            <ExerciseMedia id={id} pattern={ex.pattern} size="sm" />
                            <span className="text-sm font-semibold">{ex.name}</span>
                          </Link>
                          <ExercisePrefButtons exerciseId={id} pref={pref} compact />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        )}
      </Card>

      <Card flush className="p-2">
        <ThemeToggle theme={theme} />
        <form action={signOutFitAction}>
          <button type="submit" className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-fit-bad">
            Sair da conta <ChevronRightI className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-xs text-fit-muted">{k}</dt>
      <dd className="text-right text-sm">{v}</dd>
    </div>
  );
}

function Macro({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-fit-card-2 py-2">
      <p className="font-bold tabular-nums">{value}</p>
      <p className="flex items-center justify-center gap-1 text-[10px] text-fit-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} /> {label}
      </p>
    </div>
  );
}
