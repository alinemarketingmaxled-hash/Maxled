"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CallTask, DailyTasks } from "@/lib/calls";
import { logCallOutcomeAction } from "@/app/(app)/actions";

const SECTIONS: Array<{ key: keyof DailyTasks; title: string; icon: string; empty: string }> = [
  { key: "toCall", title: "Clientes a ligar", icon: "☎", empty: "Nenhuma ligação pendente hoje." },
  {
    key: "toQuote",
    title: "Clientes a enviar pedido / cotação",
    icon: "📄",
    empty: "Nenhum pedido ou cotação pendente.",
  },
  {
    key: "urgent",
    title: "Ligar urgentemente (6+ meses sem contato)",
    icon: "⚠",
    empty: "Nenhum cliente parado há 6 meses ou mais.",
  },
];

function TaskItem({ task, onDone }: { task: CallTask; onDone: (contactId: string, outcome: string) => void }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!outcome.trim()) return;
    startTransition(async () => {
      await logCallOutcomeAction(task.contactId, outcome);
      onDone(task.contactId, outcome);
    });
  }

  return (
    <div className="rounded-lg border border-gold-deep/25 bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">{task.contactName}</div>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{task.reason}</p>
          {task.phone && <p className="mt-0.5 text-[11px] text-ink-faint">{task.phone}</p>}
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex-none rounded-md bg-gold px-2.5 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            Concluir
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2.5 flex flex-col gap-2 border-t border-gold-deep/20 pt-2.5">
          <textarea
            autoFocus
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="O que houve na ligação?"
            rows={2}
            className="rounded-md border border-gold-deep/40 bg-surface-3 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !outcome.trim()}
              className="rounded-md bg-gold px-3 py-1.5 text-[11.5px] font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold text-ink-faint hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DailyTasksPanel({ tasks }: { tasks: DailyTasks }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function handleDone(contactId: string) {
    setDismissed((prev) => new Set(prev).add(contactId));
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-xl border border-gold-deep/30 bg-surface p-4">
      <div className="mb-3">
        <h3 className="font-display text-lg text-ink">Coisas para fazer hoje</h3>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Gerado a partir dos seus clientes e negócios reais no CRM
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3.5">
        {SECTIONS.map((section) => {
          const items = tasks[section.key].filter((t) => !dismissed.has(t.contactId));
          return (
            <div key={section.key}>
              <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
                <span>{section.icon}</span>
                {section.title}
                {items.length > 0 && (
                  <span className="ml-auto rounded-full bg-surface-2 px-1.5 text-[10.5px] text-ink-muted">
                    {items.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 ? (
                  <p className="text-[11.5px] text-ink-faint">{section.empty}</p>
                ) : (
                  items.map((task) => (
                    <TaskItem key={task.contactId} task={task} onDone={handleDone} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
