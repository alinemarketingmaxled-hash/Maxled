import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { listOnTheWayDeals } from "@/lib/deals";
import { listTasks } from "@/lib/tasks";
import { AgendaCalendar, type CalendarItem } from "@/components/agenda/AgendaCalendar";
import { TaskList } from "@/components/agenda/TaskList";

const STEPS = [
  { n: 1, title: "Negócio movido", body: 'Card entra na coluna "A caminho" no Kanban.' },
  { n: 2, title: "Prazo definido", body: "Vencimento = hoje + 3 dias úteis (fins de semana excluídos)." },
  { n: 3, title: "Mensagem pós-venda", body: "Envio automático (simulado até a integração WhatsApp real)." },
  { n: 4, title: "Avanço automático", body: "No dia do prazo, o card avança de estágio sozinho." },
];

export default async function AgendaPage() {
  const session = await requireView("agenda");
  const editable = canEdit(session.user.role, "agenda");
  const [deals, tasks] = await Promise.all([listOnTheWayDeals(session), listTasks(session)]);

  const calendarItems: CalendarItem[] = [
    ...tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        date: format(t.dueDate!, "yyyy-MM-dd"),
        label: t.title,
        type: "task" as const,
      })),
    ...deals
      .filter((d) => d.onTheWayDeadline)
      .map((d) => ({
        date: format(new Date(d.onTheWayDeadline!), "yyyy-MM-dd"),
        label: `Prazo: ${d.name}`,
        type: "deal" as const,
      })),
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Agenda</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Calendário, tarefas e automação de negócios &quot;a caminho&quot;
        </p>
      </div>

      <div className="mb-4 grid grid-cols-[320px_1fr] gap-4">
        <AgendaCalendar items={calendarItems} />
        <TaskList
          tasks={tasks.map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            done: t.done,
            ownerName: t.owner.name,
          }))}
          canEdit={editable}
        />
      </div>

      <div className="mb-6 flex overflow-hidden rounded-xl border border-gold-deep/30">
        {STEPS.map((s) => (
          <div key={s.n} className="flex-1 border-l border-gold-deep/25 bg-surface p-4 first:border-l-0">
            <div className="mb-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-black">
              {s.n}
            </div>
            <h4 className="mb-1 text-[12.5px] text-ink">{s.title}</h4>
            <p className="text-[11.5px] text-ink-muted">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {deals.length === 0 && (
          <div className="rounded-xl border border-dashed border-gold-deep/40 bg-surface px-6 py-10 text-center text-sm text-ink-muted">
            Nenhum negócio &quot;a caminho&quot; no momento.
          </div>
        )}
        {deals.map((deal) => {
          const daysLeft = deal.onTheWayDeadline
            ? differenceInCalendarDays(new Date(deal.onTheWayDeadline), new Date())
            : null;
          return (
            <Link
              key={deal.id}
              href={`/negocios/${deal.id}`}
              className="flex items-center gap-3 rounded-xl border border-gold-deep/25 bg-surface px-3.5 py-2.5 text-[12.5px] transition-colors hover:border-gold-deep/60"
            >
              <div>
                <div className="font-semibold text-ink">{deal.name}</div>
                <div className="text-[11px] text-ink-faint">
                  {deal.contact.accountName ?? `${deal.contact.firstName} ${deal.contact.lastName}`} ·{" "}
                  {deal.owner.name} · a caminho desde{" "}
                  {deal.onTheWaySince ? new Date(deal.onTheWaySince).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  daysLeft !== null && daysLeft <= 0
                    ? "bg-good/15 text-good"
                    : "bg-warning/15 text-warning"
                }`}
              >
                {daysLeft !== null && daysLeft <= 0
                  ? `avança para ${deal.stage.autoAdvanceToStage?.name ?? "próximo estágio"}`
                  : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} úteis restantes`}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
