/** Barras horizontais/verticais em CSS puro, sempre com rótulo e valor
 * escritos (nunca só cor). */
export function HBars({ rows }: { rows: { label: string; value: number; display: string; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-[12.5px]">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-ink">{r.label}</span>
            <span className="whitespace-nowrap tabular-nums text-ink-muted">
              {r.display}
              {r.sub && <span className="ml-1.5 text-ink-faint">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-3">
            <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VBars({ rows }: { rows: { label: string; value: number; display: string; highlight?: boolean }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10.5px] tabular-nums text-ink-muted">{r.display}</span>
          <div
            className={`w-full max-w-12 rounded-t ${r.highlight ? "bg-gold-bright" : "bg-gold-deep"}`}
            style={{ height: `${Math.max(2, (r.value / max) * 100)}%` }}
            title={`${r.label}: ${r.display}`}
          />
          <span className={`text-[11px] ${r.highlight ? "font-semibold text-ink" : "text-ink-faint"}`}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}
