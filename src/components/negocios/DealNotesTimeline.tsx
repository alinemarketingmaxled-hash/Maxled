"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addDealNoteAction, toggleDealNoteFlagAction } from "@/app/(app)/negocios/actions";
import { resizeImageToDataUrl } from "@/lib/resize-image";

export type TimelineNote = {
  id: string;
  body: string | null;
  createdAt: string | Date;
  flagged: boolean;
  attachmentUrl: string | null;
};
export type TimelineLog = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string | Date;
};

const ACTION_LABEL: Record<string, string> = {
  created: "criou este negócio",
  stage_changed: "mudou o estágio deste negócio",
  deleted: "excluiu este negócio",
  updated: "atualizou este negócio",
};

/** Shared by the Kanban quick-view modal and the standalone deal page — both
 * show the same note/activity history and need the same "mark a message"
 * (flag) behavior, so it lives in one place. */
export function DealNotesTimeline({
  dealId,
  notes,
  activityLogs,
  canEdit,
  onChanged,
}: {
  dealId: string;
  notes: TimelineNote[];
  activityLogs: TimelineLog[];
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [noteBody, setNoteBody] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    router.refresh();
    await onChanged?.();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachError(null);
    try {
      setAttachment(await resizeImageToDataUrl(file, 800, 0.8));
    } catch {
      setAttachError("Não foi possível ler essa imagem. Tente outra foto/print.");
    }
  }

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if ((!noteBody.trim() && !attachment) || saving) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("body", noteBody);
    if (attachment) fd.set("attachmentUrl", attachment);
    const response = await addDealNoteAction(dealId, fd);
    if (response.error) {
      setError(response.error);
      setSaving(false);
      return;
    }
    setNoteBody("");
    setAttachment(null);
    setSaving(false);
    await refresh();
  }

  async function handleToggleFlag(noteId: string) {
    await toggleDealNoteFlagAction(noteId);
    await refresh();
  }

  const sortedNotes = [...notes].sort((a, b) => Number(b.flagged) - Number(a.flagged));

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
        Histórico do cliente
      </h3>

      {canEdit && (
        <form onSubmit={handleAddNote} className="mb-3 flex flex-col gap-2">
          {error && <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-[11px] text-critical">{error}</p>}
          <div className="flex gap-2">
            <input
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Anotar print, contexto adicional…"
              className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <label
              title="Anexar foto/print"
              className="flex cursor-pointer items-center rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 text-xs text-ink-muted hover:text-gold-bright"
            >
              📎
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gold-solid px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
            >
              Adicionar
            </button>
          </div>
          {attachError && <p className="text-[11px] text-critical">{attachError}</p>}
          {attachment && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment} alt="Anexo" className="h-14 w-14 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="text-[11px] text-ink-faint hover:text-critical"
              >
                Remover anexo
              </button>
            </div>
          )}
        </form>
      )}

      <ul className="flex flex-col gap-2">
        {sortedNotes.map((note) => (
          <li
            key={note.id}
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs text-ink ${
              note.flagged ? "border border-gold/50 bg-gold/10" : "bg-surface-2"
            }`}
          >
            <div className="min-w-0 flex-1">
              {note.body}
              {note.attachmentUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={note.attachmentUrl}
                  alt="Anexo"
                  onClick={() => window.open(note.attachmentUrl ?? undefined, "_blank")}
                  className="mt-1.5 max-h-40 cursor-zoom-in rounded-md object-cover"
                />
              )}
              <div className="mt-1 text-[10px] text-ink-faint">
                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: ptBR })}
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => handleToggleFlag(note.id)}
                title={note.flagged ? "Desmarcar mensagem" : "Marcar mensagem"}
                className={`flex-none text-sm ${
                  note.flagged ? "text-gold-bright" : "text-ink-faint hover:text-gold-bright"
                }`}
              >
                {note.flagged ? "★" : "☆"}
              </button>
            )}
          </li>
        ))}
        {activityLogs.map((log) => (
          <li key={log.id} className="text-xs text-ink-muted">
            <b className="text-ink">{log.actorName}</b> {ACTION_LABEL[log.action] ?? log.action}
            <span className="ml-1.5 text-ink-faint">
              · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
            </span>
          </li>
        ))}
        {notes.length === 0 && activityLogs.length === 0 && (
          <li className="text-xs text-ink-faint">Sem histórico ainda.</li>
        )}
      </ul>
    </div>
  );
}
