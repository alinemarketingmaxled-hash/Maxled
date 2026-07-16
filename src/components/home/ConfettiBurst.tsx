"use client";

import { useState } from "react";

const COLORS = ["var(--gold-bright)", "var(--status-good)", "var(--gold)", "#ffffff"];

type Piece = { id: number; left: number; delay: number; duration: number; color: string; rotate: number };

function makePieces(): Piece[] {
  return Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.8 + Math.random() * 0.8,
    color: COLORS[i % COLORS.length],
    rotate: Math.round(Math.random() * 360),
  }));
}

/** Only ever mounted client-side (the parent flips showConfetti to true
 * inside an effect), so a lazy useState initializer is a safe place for the
 * one-time Math.random() call — it never runs during SSR/hydration. */
export function ConfettiBurst() {
  const [pieces] = useState<Piece[]>(makePieces);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 h-2 w-1 rounded-[1px]"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}
