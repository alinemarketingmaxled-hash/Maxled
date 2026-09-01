"use client";

import { useState } from "react";
import { DealDetailModal } from "@/components/negocios/DealDetailModal";

export type RecentClosedDeal = {
  id: string;
  name: string;
  value: number;
  contactName: string;
  ownerName: string | null;
  wonAt: string;
};

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Won deals drop off the Kanban board (see getBoard/getRecentlyWonDeals) —
 * this surfaces the last few months of them right on the Negócios page, so
 * finding one to edit or delete doesn't require digging into each client's
 * Histórico one at a time. Reuses the same DealDetailModal the Kanban cards
 * open, which already has the edit form and the "Excluir negócio" button. */
export function RecentClosedDealsPanel({
  deals,
  canEdit,
  monthFilterSlot,
}: {
  deals: RecentClosedDeal[];
  canEdit: boolean;
  /** The MonthFilter control, rendered top-right — kept as a slot instead of
   * a hardcoded import so this stays a plain display component. */
  monthFilterSlot?: React.ReactNode;
}) {
  const [openDealId, setOpenDealId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-ink">Fechados</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Negócios ganhos que já saíram do quadro. Clique para editar ou excluir
          </p>
        </div>
        {monthFilterSlot}
      </div>

      {deals.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">Nenhum negócio fechado nesse período.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {deals.map((d) => (
            <button
              key={d.id}
              onClick={() => setOpenDealId(d.id)}
              className="flex items-center gap-3 rounded-lg border border-gold-deep/20 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-gold-deep/60"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-ink">{d.name}</div>
                <div className="truncate text-[11px] text-ink-faint">
                  {d.contactName} · {d.ownerName ?? "-"}
                </div>
              </div>
              <span className="flex-none text-[12px] text-ink-faint">
                {new Date(d.wonAt).toLocaleDateString("pt-BR")}
              </span>
              <span className="flex-none text-[13px] font-bold text-gold-bright">
                {currency(d.value)}
              </span>
            </button>
          ))}
        </div>
      )}

      {openDealId && (
        <DealDetailModal dealId={openDealId} canEdit={canEdit} onClose={() => setOpenDealId(null)} />
      )}
    </div>
  );
}
