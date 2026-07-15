"use client";

import { useRouter } from "next/navigation";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function buildOptions(count = 12) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return options;
}

export function MonthPicker({ selected }: { selected: string }) {
  const router = useRouter();
  const options = buildOptions();

  return (
    <select
      value={selected}
      onChange={(e) => {
        const value = e.target.value;
        router.push(value === options[0].value ? "/" : `/?mes=${value}`);
      }}
      className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
