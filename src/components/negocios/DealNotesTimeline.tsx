"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addDealNoteAction, toggleDealNoteFlagAction } from "@/app/(app)/negocios/actions";

export type TimelineNote = { id: string; body: string | null; createdAt: string | Date; flagged: boolean };
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

const CALL_PREFIX = "📞 Ligação: ";

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
  const [saving, setSaving] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [savingCall, setSavingCall] = useState(false);

  async function refresh() {
    router.refresh();
    await onChanged?.();
  }

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!noteBody.trim() || saving) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("body", noteBody);
    await addDealNoteAction(dealId, fd);
    setNoteBody("");
    setSaving(false);
    await refresh();
  }

  async function handleLogCall(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!callNote.trim() || savingCall) return;
    setSavingCall(true);
    const fd = new FormData();
    fd.set("body", CALL_PREFIX + callNote.trim());
    await addDealNoteAction(dealId, fd);
    setCallNote("");
    setSavingCall(false);
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

      {canEdit && (
        <form onSubmit={handleLogCall} className="mb-3 flex gap-2">
          <input
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            placeholder="Registro rápido de ligação — o que foi tratado?"
            className="flex-1 rounded-md border border-gold-deep/25 bg-surface-2/70 px-2.5 py-1.5 text-[11px] text-ink outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={savingCall}
            className="rounded-md border border-gold-deep/40 px-3 py-1.5 text-[11px] font-semibold text-ink-muted hover:border-gold hover:text-gold-bright disabled:opacity-60"
          >
            📞 Registrar
          </button>
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
