"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getDealDetailAction,
  addDealNoteAction,
  deleteDealAction,
  type DealDetail,
} from "@/app/(app)/negocios/actions";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ACTION_LABEL: Record<string, string> = {
  created: "criou este negócio",
  stage_changed: "mudou o estágio deste negócio",
  deleted: "excluiu este negócio",
  updated: "atualizou este negócio",
};

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
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
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

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!noteBody.trim() || saving) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("body", noteBody);
    await addDealNoteAction(dealId, fd);
    setNoteBody("");
    const refreshed = await getDealDetailAction(dealId);
    setDetail(refreshed);
    setSaving(false);
  }

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
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
                Histórico do cliente
              </h3>

              {canEdit && (
                <form onSubmit={handleAddNote} className="mb-3 flex gap-2">
                  <input
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Anotar print, contexto adicional…"
                    className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-gold-solid px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
                  >
                    Adicionar
                  </button>
                </form>
              )}

              <ul className="flex flex-col gap-2">
                {detail.notes.map((note) => (
                  <li key={note.id} className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink">
                    {note.body}
                    <div className="mt-1 text-[10px] text-ink-faint">
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: ptBR })}
                    </div>
                  </li>
                ))}
                {detail.activityLogs.map((log) => (
                  <li key={log.id} className="text-xs text-ink-muted">
                    <b className="text-ink">{log.actorName}</b> {ACTION_LABEL[log.action] ?? log.action}
                    <span className="ml-1.5 text-ink-faint">
                      · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </li>
                ))}
                {detail.notes.length === 0 && detail.activityLogs.length === 0 && (
                  <li className="text-xs text-ink-faint">Sem histórico ainda.</li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
