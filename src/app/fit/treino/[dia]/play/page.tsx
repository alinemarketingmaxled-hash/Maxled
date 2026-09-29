import { notFound } from "next/navigation";
import { loadFitContext } from "@/lib/fit/server";
import { getExercise } from "@/lib/fit/exercises";
import { suggestNext } from "@/lib/fit/progression";
import { WorkoutPlayer, type PlayerExercise } from "@/components/fit/WorkoutPlayer";
import { getStretches, toSessionItems } from "@/components/fit/StretchList";

export default async function PlayPage({ params }: { params: Promise<{ dia: string }> }) {
  const { dia } = await params;
  const ctx = await loadFitContext();
  const day = /^\d+$/.test(dia) ? ctx.week.days[Number(dia)] : undefined;
  if (!day) notFound();

  const exercises: PlayerExercise[] = day.exercises.map((p) => {
    const ex = getExercise(p.exerciseId)!;
    const sug = suggestNext(p, ctx.logs);
    return {
      plan: p,
      pattern: ex.pattern,
      suggestion: sug,
      bodyweight: ex.equipment.length === 0,
      alternatives: p.alternatives.map((a) => {
        const alt = getExercise(a.id)!;
        return { id: alt.id, name: alt.name, cues: alt.cues, pattern: alt.pattern, unit: alt.unit, bodyweight: alt.equipment.length === 0 };
      }),
    };
  });

  return (
    <WorkoutPlayer
      storageKey={`fit-play-${ctx.startedAt}-${ctx.week.week}-${day.index}`}
      weekNumber={ctx.week.week}
      dayIndex={day.index}
      title={day.title}
      exercises={exercises}
      cardio={day.cardio}
      bodyKg={ctx.analysis.latest?.weightKg ?? ctx.answers.weightKg}
      stretchesBefore={toSessionItems(getStretches(day.stretchesBefore))}
      stretchesAfter={toSessionItems(getStretches(day.stretchesAfter))}
    />
  );
}
