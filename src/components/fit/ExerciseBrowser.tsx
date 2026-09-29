"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Pattern } from "@/lib/fit/exercises";
import { MUSCLE_LABEL, type Muscle } from "@/lib/fit/types";
import { ExerciseMedia } from "./ui";

export type BrowserItem = {
  id: string;
  name: string;
  muscle: Muscle;
  pattern: Pattern;
  difficulty: 1 | 2 | 3;
  available: boolean;
  blocked: boolean;
  excluded: boolean;
  favorite: boolean;
  machine: boolean;
  equipment: string;
};

const LEVEL = ["", "Fácil", "Médio", "Difícil"];

export function ExerciseBrowser({ items }: { items: BrowserItem[] }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "todos">("todos");
  const [scope, setScope] = useState<"meus" | "aparelhos" | "mobilidade" | "todos">("meus");

  const muscles = useMemo(() => [...new Set(items.map((i) => i.muscle))], [items]);
  const list = useMemo(() => {
    const term = q
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    return items.filter((i) => {
      if (muscle !== "todos" && i.muscle !== muscle) return false;
      if (scope === "meus" && (!i.available || i.blocked)) return false;
      if (scope === "aparelhos" && !i.machine) return false;
      if (scope === "mobilidade" && i.pattern !== "mobilidade") return false;
      if (!term) return true;
      const hay = `${i.name} ${MUSCLE_LABEL[i.muscle]} ${i.equipment}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      return hay.includes(term);
    });
  }, [items, q, muscle, scope]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar exercício, músculo ou aparelho"
        className="h-12 rounded-full bg-fit-card px-5 text-sm outline-none ring-fit-lime focus:ring-2"
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(
          [
            ["meus", "Para mim"],
            ["aparelhos", "Aparelhos"],
            ["mobilidade", "Mobilidade"],
            ["todos", "Todos"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setScope(k)}
            aria-pressed={scope === k}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium ${scope === k ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card-2 text-fit-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(["todos", ...muscles] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle(m)}
            aria-pressed={muscle === m}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${muscle === m ? "border-fit-lime text-fit-accent" : "border-fit-line text-fit-muted"}`}
          >
            {m === "todos" ? "Todos os músculos" : MUSCLE_LABEL[m]}
          </button>
        ))}
      </div>
      <p className="text-xs text-fit-muted">{list.length} exercícios</p>
      <div className="grid grid-cols-2 gap-3">
        {list.map((i) => (
          <Link key={i.id} href={`/fit/exercicios/${i.id}`} className="overflow-hidden rounded-[24px] bg-fit-card">
            <div className="relative">
              <ExerciseMedia id={i.id} pattern={i.pattern} animate={false} className="rounded-none" />
              {i.blocked && <span className="absolute left-2 top-2 rounded-full bg-fit-bad px-2 py-0.5 text-[10px] font-semibold text-white">Evitar</span>}
              {i.excluded && !i.blocked && <span className="absolute left-2 top-2 rounded-full bg-fit-strong/85 px-2 py-0.5 text-[10px] font-semibold text-white">Fora do treino</span>}
              {i.favorite && <span className="absolute left-2 top-2 rounded-full bg-fit-lime px-2 py-0.5 text-[10px] font-semibold text-fit-on-lime">Mantido</span>}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{i.name}</p>
              <p className="mt-1.5 flex items-center justify-between text-[11px] text-fit-muted">
                <span>{MUSCLE_LABEL[i.muscle]}</span>
                <span className="flex items-center gap-1">
                  <Dots n={i.difficulty} />
                  {LEVEL[i.difficulty]}
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-fit-muted">Nenhum exercício encontrado.</p>}
    </div>
  );
}

function Dots({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[1, 2, 3].map((k) => (
        <span key={k} className={`h-2.5 w-1 rounded-full ${k <= n ? "bg-fit-lime" : "bg-fit-card-3"}`} />
      ))}
    </span>
  );
}
