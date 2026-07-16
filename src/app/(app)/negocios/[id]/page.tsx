import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { canEdit } from "@/lib/permissions";
import { requireView } from "@/lib/require-permission";
import { getDeal } from "@/lib/deals";
import { addDealNoteAction, deleteDealAction } from "../actions";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireView("negocios");
  const { id } = await params;
  const editable = canEdit(session.user.role, "negocios");

  const deal = await getDeal(session, id);
  if (!deal) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/negocios" className="mb-4 inline-block text-xs text-ink-muted hover:text-gold-bright">
        ← Voltar ao quadro
      </Link>

      <div className="rounded-xl border border-gold-deep/30 bg-surface p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg text-ink">{deal.name}</h2>
            <p className="text-xs text-ink-muted">
              {deal.contact.firstName} {deal.contact.lastName}
              {deal.contact.accountName ? ` — ${deal.contact.accountName}` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-xl text-gold-bright">
              {Number(deal.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <div className="text-[11px] text-ink-faint">{deal.stage.name}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-dashed border-gold-deep/25 pt-3 text-[12.5px]">
          <div>
            <span className="text-ink-faint">Proprietário: </span>
            <span className="text-ink">{deal.owner.name}</span>
          </div>
          {deal.onTheWayDeadline && (
            <div>
              <span className="text-ink-faint">Prazo (a caminho): </span>
              <span className="text-warning">
                {new Date(deal.onTheWayDeadline).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}
        </div>

        {editable && (
          <form action={deleteDealAction.bind(null, deal.id)} className="mt-4 border-t border-gold-deep/25 pt-4">
            <button
              type="submit"
              className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical"
            >
              Excluir negócio
            </button>
          </form>
        )}

        <div className="mt-5 border-t border-gold-deep/25 pt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
            Histórico do cliente
          </h3>

          {editable && (
            <form action={addDealNoteAction.bind(null, deal.id)} className="mb-3 flex gap-2">
              <input
                name="body"
                placeholder="Anotar print, contexto adicional…"
                className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
              <button
                type="submit"
                className="rounded-md bg-gold-solid px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright"
              >
                Adicionar
              </button>
            </form>
          )}

          <ul className="flex flex-col gap-2">
            {deal.notes.map((note) => (
              <li key={note.id} className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink">
                {note.body}
                <div className="mt-1 text-[10px] text-ink-faint">
                  {formatDistanceToNow(note.createdAt, { addSuffix: true, locale: ptBR })}
                </div>
              </li>
            ))}
            {deal.activityLogs.map((log) => (
              <li key={log.id} className="text-xs text-ink-muted">
                <b className="text-ink">{log.actor.name}</b>{" "}
                {log.action === "created" && "criou este negócio"}
                {log.action === "stage_changed" && "mudou o estágio deste negócio"}
                {log.action === "deleted" && "excluiu este negócio"}
                {log.action === "updated" && "atualizou este negócio"}
                <span className="ml-1.5 text-ink-faint">
                  · {formatDistanceToNow(log.createdAt, { addSuffix: true, locale: ptBR })}
                </span>
              </li>
            ))}
            {deal.notes.length === 0 && deal.activityLogs.length === 0 && (
              <li className="text-xs text-ink-faint">Sem histórico ainda.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
