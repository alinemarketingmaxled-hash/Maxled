import Link from "next/link";
import { canEdit } from "@/lib/permissions";
import { getBoard, getRecentlyWonDeals, type DealContactFilters } from "@/lib/deals";
import { listDistinctProfiles } from "@/lib/contacts";
import { requireView } from "@/lib/require-permission";
import { KanbanBoard } from "@/components/negocios/KanbanBoard";
import { RecentClosedDealsPanel } from "@/components/negocios/RecentClosedDealsPanel";
import { ContactCategoryFilters } from "@/components/shared/ContactCategoryFilters";
import { MonthFilter } from "@/components/shared/MonthFilter";
import { parseMonthParam } from "@/lib/month-filter";
import type { CrmStatus, CommercialPotential, PersonType } from "@/generated/prisma/client";
import { serializeDeal } from "@/lib/serialize-deal";

export default async function NegociosPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    potencial?: string;
    tipo?: string;
    perfil?: string;
    mes?: string;
  }>;
}) {
  const session = await requireView("negocios");
  const params = await searchParams;
  const editable = canEdit(session.user.role, "negocios");

  const filters: DealContactFilters = {
    crmStatus: params.status as CrmStatus | undefined,
    commercialPotential: params.potencial as CommercialPotential | undefined,
    personType: params.tipo as PersonType | undefined,
    profile: params.perfil,
  };
  const wonMonth = parseMonthParam(params.mes) ?? undefined;

  const [pipeline, recentlyWon, profiles] = await Promise.all([
    getBoard(session, filters),
    getRecentlyWonDeals(session, wonMonth),
    listDistinctProfiles(session),
  ]);
  const stages = pipeline?.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    order: stage.order,
    isOnTheWay: stage.isOnTheWay,
    deals: stage.deals.map(serializeDeal),
  }));

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-4">
        <h2 className="font-display text-[22px] text-ink">Negócios</h2>
        {editable && (
          <Link
            href="/negocios/novo"
            className="rounded-lg bg-gold-solid px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-solid-bright"
          >
            ＋ Novo negócio
          </Link>
        )}
      </div>
      <p className="-mt-2.5 mb-4 text-[13px] text-ink-muted">
        Kanban · colunas editáveis, adicionáveis e removíveis
      </p>

      <ContactCategoryFilters profiles={profiles} />

      {pipeline && stages ? (
        <KanbanBoard stages={stages} pipelineId={pipeline.id} canEdit={editable} />
      ) : (
        <div className="rounded-xl border border-dashed border-gold-deep/40 bg-surface px-6 py-10 text-center text-sm text-ink-muted">
          Nenhum pipeline configurado ainda.
        </div>
      )}

      <div className="mt-4">
        <RecentClosedDealsPanel
          canEdit={editable}
          monthFilterSlot={
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ink-faint">Período:</span>
              <MonthFilter defaultLabel="Últimos 3 meses" />
            </div>
          }
          deals={recentlyWon.map((d) => ({
            id: d.id,
            name: d.name,
            value: Number(d.value),
            contactName: d.contact.accountName || `${d.contact.firstName} ${d.contact.lastName}`,
            ownerName: d.owner.name,
            wonAt: d.updatedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
