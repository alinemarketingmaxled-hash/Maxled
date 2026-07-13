import Link from "next/link";
import { canEdit } from "@/lib/permissions";
import { getBoard } from "@/lib/deals";
import { requireView } from "@/lib/require-permission";
import { KanbanBoard } from "@/components/negocios/KanbanBoard";
import { serializeDeal } from "@/lib/serialize-deal";

export default async function NegociosPage() {
  const session = await requireView("negocios");
  const editable = canEdit(session.user.role, "negocios");
  const pipeline = await getBoard(session);
  const stages = pipeline?.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    order: stage.order,
    isOnTheWay: stage.isOnTheWay,
    deals: stage.deals.map(serializeDeal),
  }));

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] text-ink">Negócios</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Kanban · colunas editáveis, adicionáveis e removíveis
          </p>
        </div>
        {editable && (
          <Link
            href="/negocios/novo"
            className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            ＋ Novo negócio
          </Link>
        )}
      </div>

      {pipeline && stages ? (
        <KanbanBoard stages={stages} pipelineId={pipeline.id} canEdit={editable} />
      ) : (
        <div className="rounded-xl border border-dashed border-gold-deep/40 bg-surface px-6 py-10 text-center text-sm text-ink-muted">
          Nenhum pipeline configurado ainda.
        </div>
      )}
    </div>
  );
}
