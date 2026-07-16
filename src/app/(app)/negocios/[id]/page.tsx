import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit } from "@/lib/permissions";
import { requireView } from "@/lib/require-permission";
import { getDeal } from "@/lib/deals";
import { deleteDealAction } from "../actions";
import { DealNotesTimeline } from "@/components/negocios/DealNotesTimeline";

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
          <DealNotesTimeline
            dealId={deal.id}
            notes={deal.notes}
            activityLogs={deal.activityLogs.map((log) => ({
              id: log.id,
              action: log.action,
              actorName: log.actor.name,
              createdAt: log.createdAt,
            }))}
            canEdit={editable}
          />
        </div>
      </div>
    </div>
  );
}
