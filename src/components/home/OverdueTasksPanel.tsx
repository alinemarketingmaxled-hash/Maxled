"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleTaskAction, deleteTaskAction } from "@/app/(app)/agenda/actions";
import type { TaskRow } from "@/components/agenda/TaskList";

export function OverdueTasksPanel({ tasks, canEdit }: { tasks: TaskRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function handleToggle(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await toggleTaskAction(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await deleteTaskAction(id);
      router.refresh();
    });
  }

  const visible = tasks.filter((t) => !dismissed.has(t.id));

  return (
    <div className="rounded-xl border border-critical/30 bg-surface p-4">
      <div className="mb-3">
        <h3 className="font-display text-lg text-ink">⏰ Atrasos</h3>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Tarefas com prazo vencido que ainda não foram concluídas
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">Nada atrasado — tudo em dia!</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg border-l-4 border-l-critical bg-surface-2 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-ink">{t.title}</div>
                <div className="text-[11px] text-critical">
                  Venceu em {t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : "—"} ·{" "}
                  {t.ownerName}
                </div>
              </div>
              {canEdit && (
                <div className="flex flex-none gap-1.5">
                  <button
                    onClick={() => handleToggle(t.id)}
                    disabled={isPending}
                    className="rounded-md bg-gold-solid px-2.5 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:opacity-50"
                  >
                    Concluir
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={isPending}
                    className="rounded-md px-2 py-1 text-[11px] text-ink-faint hover:text-critical disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
