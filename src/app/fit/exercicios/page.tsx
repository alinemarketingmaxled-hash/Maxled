import { EXERCISES, canDo, isMachine, equipmentText } from "@/lib/fit/exercises";
import { EQUIPMENT_LABEL, MACHINES, type Equipment } from "@/lib/fit/types";
import { getFitProfile, requireFitUser } from "@/lib/fit/server";
import { ExerciseBrowser, type BrowserItem } from "@/components/fit/ExerciseBrowser";
import { TopBar } from "@/components/fit/ui";

export default async function ExerciciosPage() {
  const user = await requireFitUser();
  const profile = await getFitProfile(user.id);
  const owned = new Set<Equipment>([...(profile?.answers.equipment ?? ["academia"]), "peso_corporal"]);
  const limits = new Set(profile?.answers.limitations ?? []);
  const items: BrowserItem[] = EXERCISES.map((e) => ({
    id: e.id,
    name: e.name,
    muscle: e.muscle,
    pattern: e.pattern,
    difficulty: e.difficulty,
    available: canDo(e, owned),
    blocked: e.avoid.some((l) => limits.has(l)),
    machine: isMachine(e, MACHINES),
    equipment: equipmentText(e, EQUIPMENT_LABEL),
  })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <main className="flex flex-col gap-2">
      <TopBar title="Exercícios" back="/fit/treino" />
      <ExerciseBrowser items={items} />
      <p className="mt-6 text-center text-[10px] text-fit-faint">Fotos: Free Exercise DB (domínio público).</p>
    </main>
  );
}
