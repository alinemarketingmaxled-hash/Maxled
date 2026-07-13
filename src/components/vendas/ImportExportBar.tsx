import { importContactsAction } from "@/app/(app)/vendas/actions";

export function ImportExportBar({
  canEdit,
  importSummary,
}: {
  canEdit: boolean;
  importSummary?: string;
}) {
  const [created, updated, skipped] = importSummary?.split("-").map(Number) ?? [];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <a
        href="/vendas/export"
        className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
      >
        ⭳ Exportar tabela
      </a>
      {canEdit && (
        <form action={importContactsAction} className="flex items-center gap-2">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-xs text-ink-muted file:mr-2 file:rounded-md file:border file:border-gold-deep file:bg-surface-2 file:px-2.5 file:py-1 file:text-xs file:text-ink"
          />
          <button
            type="submit"
            className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
          >
            ⭱ Importar CSV
          </button>
        </form>
      )}
      {importSummary && (
        <span className="text-xs text-ink-muted">
          Importação: <span className="text-good">{created} criados</span> ·{" "}
          <span className="text-info">{updated} atualizados</span> ·{" "}
          <span className="text-ink-faint">{skipped} ignorados</span>
        </span>
      )}
    </div>
  );
}
