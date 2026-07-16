"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importContactsAction } from "@/app/(app)/vendas/actions";

export function ImportExportBar({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [isImporting, startImport] = useTransition();

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.set("file", file);
    startImport(async () => {
      const response = await importContactsAction(formData);
      if (response.error) {
        setError(response.error);
        return;
      }
      if (response.summary) {
        setResult(response.summary);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/vendas/export"
          className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
        >
          ⭳ Exportar tabela
        </a>
        {canEdit && (
          <a
            href="/vendas/import-template"
            className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
          >
            📋 Baixar modelo de importação
          </a>
        )}
        {canEdit && (
          <form onSubmit={handleImport} className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".csv,text/csv"
              className="text-xs text-ink-muted file:mr-2 file:rounded-md file:border file:border-gold-deep file:bg-surface-2 file:px-2.5 file:py-1 file:text-xs file:text-ink"
            />
            <button
              type="submit"
              disabled={isImporting}
              className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? "Importando…" : "⭱ Importar CSV"}
            </button>
          </form>
        )}
        {result && (
          <span className="text-xs text-ink-muted">
            Importação: <span className="text-good">{result.created} criados</span> ·{" "}
            <span className="text-info">{result.updated} atualizados</span> ·{" "}
            <span className="text-ink-faint">{result.skipped} ignorados</span>
          </span>
        )}
      </div>
      {error && <p className="text-xs text-critical">{error}</p>}
    </div>
  );
}
