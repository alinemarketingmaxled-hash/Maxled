"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DateRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function apply() {
    if (!fromVal || !toVal) return;
    router.push(`/?de=${fromVal}&ate=${toVal}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={fromVal}
        onChange={(e) => setFromVal(e.target.value)}
        className="rounded-md border border-gold-deep/40 bg-surface-2 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
      />
      <span className="text-[11px] text-ink-faint">até</span>
      <input
        type="date"
        value={toVal}
        onChange={(e) => setToVal(e.target.value)}
        className="rounded-md border border-gold-deep/40 bg-surface-2 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
      />
      <button
        onClick={apply}
        className="rounded-md bg-gold-solid px-2.5 py-1.5 text-[11.5px] font-semibold text-black transition-colors hover:bg-gold-solid-bright"
      >
        Aplicar
      </button>
    </div>
  );
}
