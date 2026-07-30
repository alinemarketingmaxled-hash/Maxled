"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
];
const POTENTIAL_OPTIONS = [
  { value: "ALTO", label: "Alto" },
  { value: "MEDIO", label: "Médio" },
  { value: "BAIXO", label: "Baixo" },
];
const PERSON_TYPE_OPTIONS = [
  { value: "FISICA", label: "Física" },
  { value: "JURIDICA", label: "Jurídica" },
];

export type ContactFilterField = "status" | "potencial" | "tipo" | "perfil";
const ALL_FIELDS: ContactFilterField[] = ["status", "potencial", "tipo", "perfil"];

/** Status/Potencial/Tipo de pessoa/Perfil filters shared by Vendas and
 * Negócios — both filter contacts (Negócios filters deals by their linked
 * contact) by the same four fields, so one component drives both. Filters
 * live in the URL (status/potencial/tipo/perfil) so they survive a refresh
 * and can be shared/bookmarked. `fields` restricts which selects render —
 * Vendas only wants Perfil, Negócios keeps all four (the default). */
export function ContactCategoryFilters({
  profiles,
  fields = ALL_FIELDS,
}: {
  profiles: string[];
  fields?: ContactFilterField[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const potencial = searchParams.get("potencial") ?? "";
  const tipo = searchParams.get("tipo") ?? "";
  const perfil = searchParams.get("perfil") ?? "";
  const hasActiveFilter = fields.some((f) => searchParams.get(f));

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    fields.forEach((f) => params.delete(f));
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    "rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {fields.includes("status") && (
        <select className={selectClass} value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">Status: todos</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {fields.includes("potencial") && (
        <select
          className={selectClass}
          value={potencial}
          onChange={(e) => setParam("potencial", e.target.value)}
        >
          <option value="">Potencial: todos</option>
          {POTENTIAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {fields.includes("tipo") && (
        <select className={selectClass} value={tipo} onChange={(e) => setParam("tipo", e.target.value)}>
          <option value="">Tipo de pessoa: todos</option>
          {PERSON_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {fields.includes("perfil") && (
        <select className={selectClass} value={perfil} onChange={(e) => setParam("perfil", e.target.value)}>
          <option value="">Perfil: todos</option>
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      )}
      {hasActiveFilter && (
        <button
          onClick={clearAll}
          className="rounded-md px-2 py-1.5 text-[11.5px] text-ink-faint hover:text-critical"
        >
          × limpar filtros
        </button>
      )}
    </div>
  );
}
