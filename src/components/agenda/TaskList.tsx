"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction, toggleTaskAction, deleteTaskAction } from "@/app/(app)/agenda/actions";

export type TaskRow = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  ownerName: string;
  dealId?: string | null;
  dealName?: string | null;
};

export function TaskList({ tasks, canEdit }: { tasks: TaskRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createTaskAction(title, dueDate);
      setTitle("");
      setDueDate("");
      router.refresh();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleTaskAction(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTaskAction(id);
      router.refresh();
    });
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  function isOverdue(t: TaskRow) {
    return !!t.dueDate && new Date(t.dueDate) < startOfToday;
  }

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface p-4">
      <h3 className="mb-3 text-[13px] font-semibold text-ink">Tarefas</h3>

      {canEdit && (
        <div className="mb-3 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Nova tarefa…"
            className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
          />
          <button
            onClick={handleAdd}
            disabled={isPending || !title.trim()}
            className="rounded-md bg-gold-solid px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {tasks.length === 0 && <p className="text-[11.5px] text-ink-faint">Nenhuma tarefa ainda.</p>}
        {pending.map((t) => {
          const overdue = isOverdue(t);
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-surface-2 ${
                overdue ? "border-l-4 border-l-critical bg-critical/[0.05]" : ""
              }`}
            >
              <button
                onClick={() => canEdit && handleToggle(t.id)}
                className="flex h-4 w-4 flex-none items-center justify-center rounded border border-gold-deep"
              />
              <span className="flex-1 text-[12.5px] text-ink">{t.title}</span>
              {overdue && (
                <span className="rounded-full bg-critical/15 px-1.5 py-0.5 text-[10px] font-semibold text-critical">
                  Atrasado
                </span>
              )}
              {t.dueDate && (
                <span className={`text-[11px] ${overdue ? "text-critical" : "text-ink-faint"}`}>
                  {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                </span>
              )}
              {canEdit && (
                <button onClick={() => handleDelete(t.id)} className="text-ink-faint hover:text-critical">
                  ×
                </button>
              )}
            </div>
          );
        })}
        {done.length > 0 && (
          <>
            <div className="mt-2 border-t border-gold-deep/20 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Concluídas
            </div>
            {done.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-md px-1.5 py-1 opacity-50">
                <button
                  onClick={() => canEdit && handleToggle(t.id)}
                  className="flex h-4 w-4 flex-none items-center justify-center rounded border border-gold-deep bg-gold-solid text-[10px] text-black"
                >
                  ✓
                </button>
                <span className="flex-1 text-[12.5px] text-ink line-through">{t.title}</span>
                {canEdit && (
                  <button onClick={() => handleDelete(t.id)} className="text-ink-faint hover:text-critical">
                    ×
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
