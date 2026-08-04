"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ACTION_OPTIONS = [
  { value: "created", label: "Criou" },
  { value: "updated", label: "Atualizou" },
  { value: "deleted", label: "Excluiu" },
  { value: "restored", label: "Restaurou" },
  { value: "stage_changed", label: "Mudou o estágio" },
  { value: "call_logged", label: "Registrou uma ligação" },
  { value: "unlocked", label: "Desbloqueou/alterou acesso" },
];

/** Audit filters for the Config page's activity feed — actor is only shown
 * when there's more than one to pick from (a "own"-scoped seller only ever
 * sees themselves, so the select would be pointless noise for them). */
export function ActivityLogFilters({ actors }: { actors: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const actorId = searchParams.get("actorId") ?? "";
  const action = searchParams.get("action") ?? "";
  const hasActiveFilter = Boolean(actorId || action);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("actorId");
    params.delete("action");
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    "rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {actors.length > 1 && (
        <select className={selectClass} value={actorId} onChange={(e) => setParam("actorId", e.target.value)}>
          <option value="">Quem: todos</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      <select className={selectClass} value={action} onChange={(e) => setParam("action", e.target.value)}>
        <option value="">Ação: todas</option>
        {ACTION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hasActiveFilter && (
        <button onClick={clearAll} className="rounded-md px-2 py-1.5 text-[11.5px] text-ink-faint hover:text-critical">
          × limpar filtros
        </button>
      )}
    </div>
  );
}
