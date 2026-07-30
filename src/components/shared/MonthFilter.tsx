"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

/** Generic "ver outros meses" picker for filtering a list — works on any
 * page: it targets the current pathname and preserves whatever other
 * filters are already in the URL (e.g. status/perfil on Vendas). Unlike the
 * Início dashboard's MonthPicker (whose natural default is "this month"),
 * a filtered list's natural default is "todos os meses" — so that's the
 * first option here, and picking it clears the param entirely. */
export function MonthFilter({
  paramName = "mes",
  defaultLabel = "Todos os meses",
}: {
  paramName?: string;
  /** Label for the "no filter" option — override when the page's actual
   * default isn't literally everything (e.g. Negócios defaults to the last
   * 3 months, not all-time). */
  defaultLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = buildOptions();
  const selected = searchParams.get(paramName) ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(paramName);
    else params.set(paramName, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
    >
      <option value="">{defaultLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
