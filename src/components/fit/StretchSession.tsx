"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftI, ArrowRightI, CheckI, PauseI, PlayI } from "./FitIcons";
import { FramesMedia } from "./ui";

export type SessionStretch = { id: string; name: string; dose: string; seconds: number; cues: string[]; frames: [string, string] };

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    g.gain.value = 0.12;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    navigator.vibrate?.(150);
  } catch {
    // optional
  }
}

/** One stretch at a time: animated photo, dose, cues and a countdown that
 * moves on by itself. */
export function StretchSession({
  title,
  items,
  onClose,
  doneLabel = "Concluir",
}: {
  title: string;
  items: SessionStretch[];
  onClose: (completed: boolean) => void;
  doneLabel?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(items[0]?.seconds ?? 0);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);
  const idxRef = useRef(idx);

  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  useEffect(() => {
    if (!running || finished) return;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l > 1) return l - 1;
        beep();
        const next = idxRef.current + 1;
        if (next >= items.length) {
          setFinished(true);
          return 0;
        }
        setIdx(next);
        return items[next].seconds;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, finished, items]);

  function go(to: number) {
    if (to < 0) return;
    if (to >= items.length) {
      setFinished(true);
      return;
    }
    setIdx(to);
    setLeft(items[to].seconds);
  }

  if (items.length === 0) return null;
  const s = items[idx];
  const total = items.length;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-fit-bg">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 pb-8 pt-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => onClose(false)} className="rounded-full bg-fit-card px-3 py-2 text-xs font-medium">
            Fechar
          </button>
          <p className="text-xs text-fit-muted">{title}</p>
          <p className="text-xs tabular-nums text-fit-muted">
            {Math.min(idx + 1, total)}/{total}
          </p>
        </div>
        <div className="flex gap-1">
          {items.map((it, i) => (
            <span key={it.id} className={`h-1.5 flex-1 rounded-full ${i < idx || finished ? "bg-fit-lime" : i === idx ? "bg-fit-lime/60" : "bg-fit-card-3"}`} />
          ))}
        </div>

        {finished ? (
          <div className="fit-pop flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-fit-lime text-fit-on-lime">
              <CheckI className="h-12 w-12" strokeWidth={3} />
            </span>
            <h2 className="text-2xl font-bold">Alongamento feito!</h2>
            <button type="button" onClick={() => onClose(true)} className="h-14 w-full rounded-full bg-fit-lime font-semibold text-fit-on-lime">
              {doneLabel}
            </button>
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-[32px] bg-fit-card">
              <FramesMedia frames={s.frames} className="h-72 w-full" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent p-4 pt-16">
                <span className="text-xs font-semibold text-white/80">{s.dose}</span>
                <span key={s.id} className="fit-pop text-6xl font-bold tabular-nums text-[#d6f94b]">
                  {left}
                </span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">{s.name}</h1>
              <ul className="mt-2 space-y-1 text-sm text-fit-muted">
                {s.cues.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2">
              <button type="button" disabled={idx === 0} onClick={() => go(idx - 1)} className="flex h-12 items-center justify-center rounded-full bg-fit-card disabled:opacity-40" aria-label="Anterior">
                <ArrowLeftI className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setRunning((r) => !r)} className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-fit-card text-sm font-medium">
                {running ? <PauseI className="h-4 w-4" /> : <PlayI className="h-4 w-4" />}
                {running ? "Pausar" : "Seguir"}
              </button>
              <button type="button" onClick={() => go(idx + 1)} className="flex h-12 items-center justify-center rounded-full bg-fit-lime text-fit-on-lime" aria-label="Próximo">
                <ArrowRightI className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
