"use client";

import { useEffect, useState } from "react";
import { ConfettiBurst } from "@/components/home/ConfettiBurst";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function GoalProgressBar({
  achieved,
  goal1,
  goal2,
  commissionPct1,
  commissionPct2,
}: {
  achieved: number;
  goal1: number;
  goal2: number | null;
  commissionPct1: number | null;
  commissionPct2: number | null;
}) {
  const reachedGoal1 = achieved >= goal1;
  const reachedGoal2 = goal2 !== null && achieved >= goal2;
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!reachedGoal1) return;
    // Celebrate once per browser tab per month, not on every navigation.
    const key = `maxled-confetti-goal1-${new Date().getFullYear()}-${new Date().getMonth()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const showTimeout = setTimeout(() => setShowConfetti(true), 0);
    const hideTimeout = setTimeout(() => setShowConfetti(false), 2600);
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [reachedGoal1]);

  const max = goal2 !== null && goal2 > goal1 ? goal2 : goal1 * 1.25;
  const fillPct = Math.min(100, (achieved / max) * 100);
  const goal1Pos = Math.min(100, (goal1 / max) * 100);
  const goal2Pos = goal2 !== null ? Math.min(100, (goal2 / max) * 100) : null;

  return (
    <div className="relative">
      {showConfetti && <ConfettiBurst />}

      {reachedGoal1 && (
        <div className="mb-3 rounded-md bg-good/15 px-2.5 py-1.5 text-center text-[12px] font-semibold text-good">
          🎉 Parabéns! Meta 1 batida!
        </div>
      )}

      <div className="relative mt-2 h-3 w-full rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-gold-solid transition-[width]"
          style={{ width: `${fillPct}%` }}
        />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${goal1Pos}%` }}>
          <div className={`h-4 w-1 rounded-full ${reachedGoal1 ? "bg-good" : "bg-ink-faint"}`} />
        </div>
        {goal2Pos !== null && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${goal2Pos}%` }}>
            <div className={`h-4 w-1 rounded-full ${reachedGoal2 ? "bg-good" : "bg-ink-faint"}`} />
          </div>
        )}
      </div>

      <div className="relative mt-1.5 h-9 text-[10px] text-ink-faint">
        <div className="absolute -translate-x-1/2 text-center" style={{ left: `${goal1Pos}%` }}>
          <div className="font-semibold text-ink">Meta 1</div>
          <div>{currency(goal1)}</div>
          {commissionPct1 !== null && <div>{commissionPct1}%</div>}
        </div>
        {goal2Pos !== null && goal2 !== null && (
          <div className="absolute -translate-x-1/2 text-center" style={{ left: `${goal2Pos}%` }}>
            <div className="font-semibold text-ink">Meta 2</div>
            <div>{currency(goal2)}</div>
            {commissionPct2 !== null && <div>{commissionPct2}%</div>}
          </div>
        )}
      </div>
    </div>
  );
}
