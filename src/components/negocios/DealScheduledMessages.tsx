"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createDealMessageAction,
  toggleDealMessageAction,
  deleteDealMessageAction,
} from "@/app/(app)/negocios/actions";

export type ScheduledMessage = { id: string; title: string; dueDate: string | null; done: boolean };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function DealScheduledMessages({
  dealId,
  messages,
  canEdit,
  onChanged,
}: {
  dealId: string;
  messages: ScheduledMessage[];
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    router.refresh();
    await onChanged?.();
  }

  async function handleSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !dueDate || saving) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("dueDate", dueDate);
    const response = await createDealMessageAction(dealId, fd);
    if (response.error) {
      setError(response.error);
      setSaving(false);
      return;
    }
    setTitle("");
    setDueDate("");
    setSaving(false);
    await refresh();
  }

  async function handleToggle(taskId: string) {
    await toggleDealMessageAction(taskId);
    await refresh();
  }

  async function handleDelete(taskId: string) {
    await deleteDealMessageAction(taskId);
    await refresh();
  }

  const pending = messages.filter((m) => !m.done);
  const done = messages.filter((m) => m.done);

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
        Mensagens agendadas
      </h3>

      {canEdit && (
        <form onSubmit={handleSchedule} className="mb-3 flex flex-col gap-2">
          {error && (
            <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-[11px] text-critical">{error}</p>
          )}
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mensagem a enviar (ex.: lembrar do orçamento)…"
              className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gold-solid px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
            >
              Agendar
            </button>
          </div>
        </form>
      )}

      <ul className="flex flex-col gap-2">
        {pending.map((m) => (
          <li
            key={m.id}
            className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink"
          >
            <div className="min-w-0 flex-1">
              {m.title}
              {m.dueDate && <div className="mt-1 text-[10px] text-ink-faint">📅 {formatDate(m.dueDate)}</div>}
            </div>
            {canEdit && (
              <div className="flex flex-none gap-2">
                <button
                  onClick={() => handleToggle(m.id)}
                  title="Marcar como enviada"
                  className="text-ink-faint hover:text-good"
                >
                  ✓
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  title="Cancelar"
                  className="text-ink-faint hover:text-critical"
                >
                  ×
                </button>
              </div>
            )}
          </li>
        ))}
        {done.length > 0 && (
          <li className="text-[10.5px] text-ink-faint">
            {done.length} mensagem{done.length > 1 ? "s" : ""} já enviada{done.length > 1 ? "s" : ""}
          </li>
        )}
        {messages.length === 0 && (
          <li className="text-xs text-ink-faint">Nenhuma mensagem agendada para este negócio.</li>
        )}
      </ul>
    </div>
  );
}
