"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDealDetailAction, deleteDealAction, type DealDetail } from "@/app/(app)/negocios/actions";
import { DealNotesTimeline } from "@/components/negocios/DealNotesTimeline";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DealDetailModal({
  dealId,
  canEdit,
  onClose,
}: {
  dealId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  // undefined = still loading, null = fetched but not found/no permission.
  const [detail, setDetail] = useState<DealDetail | null | undefined>(undefined);
  const loading = detail === undefined;

  useEffect(() => {
    let cancelled = false;
    getDealDetailAction(dealId).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleDelete() {
    if (!detail || !confirm(`Excluir o negócio "${detail.name}"?`)) return;
    await deleteDealAction(dealId);
    onClose();
    router.refresh();
  }

  function handleClose() {
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gold-deep/40 bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          aria-label="Fechar"
          className="float-right text-lg leading-none text-ink-faint hover:text-ink"
        >
          ×
        </button>

        {loading && <p className="text-xs text-ink-faint">Carregando…</p>}
        {!loading && !detail && <p className="text-xs text-ink-faint">Negócio não encontrado.</p>}

        {detail && (
          <>
            <div className="mb-4 flex items-start justify-between gap-4 pr-6">
              <div>
                <h2 className="font-display text-lg text-ink">{detail.name}</h2>
                <p className="text-xs text-ink-muted">
                  {detail.contactName}
                  {detail.accountName ? ` — ${detail.accountName}` : ""}
                </p>
              </div>
              <div className="flex-none text-right">
                <div className="font-display text-xl text-gold-bright">{currency(detail.value)}</div>
                <div className="text-[11px] text-ink-faint">{detail.stageName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-dashed border-gold-deep/25 pt-3 text-[12.5px]">
              <div>
                <span className="text-ink-faint">Proprietário: </span>
                <span className="text-ink">{detail.ownerName}</span>
              </div>
              {detail.onTheWayDeadline && (
                <div>
                  <span className="text-ink-faint">Prazo (a caminho): </span>
                  <span className="text-warning">
                    {new Date(detail.onTheWayDeadline).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="mt-4 border-t border-gold-deep/25 pt-4">
                <button
                  onClick={handleDelete}
                  className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical"
                >
                  Excluir negócio
                </button>
              </div>
            )}

            <div className="mt-5 border-t border-gold-deep/25 pt-4">
              <DealNotesTimeline
                dealId={detail.id}
                notes={detail.notes}
                activityLogs={detail.activityLogs}
                canEdit={canEdit}
                onChanged={async () => setDetail(await getDealDetailAction(dealId))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
