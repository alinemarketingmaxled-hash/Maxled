"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setExercisePreferenceAction } from "@/app/fit/actions";
import { CheckI, StarI, TrashI } from "./FitIcons";

export type ExercisePref = "excluir" | "manter" | "neutro";

/** "Manter sempre" / "Não quero este" for one exercise. Excluding it makes
 * the generator pick the next best option for that slot on refresh. */
export function ExercisePrefButtons({ exerciseId, pref, compact = false }: { exerciseId: string; pref: ExercisePref; compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function set(next: ExercisePref) {
    setMsg(null);
    start(async () => {
      const res = await setExercisePreferenceAction(exerciseId, next);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      // In a workout day the row is replaced by the new exercise, so the
      // confirmation lives in the page (?removido=) with an undo.
      if (next === "excluir" && pathname.startsWith("/fit/treino/")) {
        router.replace(`${pathname}?removido=${encodeURIComponent(exerciseId)}`, { scroll: false });
        router.refresh();
        return;
      }
      setMsg(
        next === "excluir"
          ? "Removido. Seu treino já usa outro exercício no lugar."
          : next === "manter"
            ? "Vai continuar no seu treino sempre que couber."
            : "Preferência removida.",
      );
      router.refresh();
    });
  }

  if (pref === "excluir") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-fit-bad/15 px-3 py-1.5 text-fit-bad">Fora do seu treino</span>
        <button type="button" disabled={pending} onClick={() => set("neutro")} className="rounded-full bg-fit-card-2 px-3 py-1.5 font-medium">
          Voltar a incluir
        </button>
        {msg && <span className="w-full text-fit-muted">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => set(pref === "manter" ? "neutro" : "manter")}
        aria-pressed={pref === "manter"}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ${pref === "manter" ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card-2"}`}
      >
        {pref === "manter" ? <CheckI className="h-3.5 w-3.5" /> : <StarI className="h-3.5 w-3.5" />}
        {pref === "manter" ? "Mantido" : compact ? "Manter" : "Manter sempre"}
      </button>
      <button type="button" disabled={pending} onClick={() => set("excluir")} className="flex items-center gap-1.5 rounded-full bg-fit-card-2 px-3 py-1.5 font-medium">
        <TrashI className="h-3.5 w-3.5" />
        Não quero este
      </button>
      {pending && <span className="text-fit-muted">Ajustando...</span>}
      {msg && !pending && <span className="w-full text-fit-muted">{msg}</span>}
    </div>
  );
}

/** Banner shown after "Não quero este" on a workout day, with undo. */
export function RemovedBanner({ exerciseId, name, replacement }: { exerciseId: string; name: string; replacement: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  return (
    <div className="fit-pop flex items-start gap-3 rounded-[24px] bg-fit-lime p-4 text-fit-on-lime">
      <CheckI className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={3} />
      <p className="flex-1 text-sm">
        <b>{name}</b> saiu do seu treino{replacement ? (
          <>
            {" "}e entrou <b>{replacement}</b> no lugar.
          </>
        ) : (
          "."
        )}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setExercisePreferenceAction(exerciseId, "neutro");
            router.replace(pathname, { scroll: false });
            router.refresh();
          })
        }
        className="shrink-0 rounded-full bg-fit-strong px-3 py-1.5 text-xs font-semibold text-[#d6f94b]"
      >
        Desfazer
      </button>
    </div>
  );
}
