"use client";

import { useState } from "react";
import { DealDetailModal } from "@/components/negocios/DealDetailModal";

export type InProgressDeal = {
  id: string;
  name: string;
  value: number;
  stageName: string;
  contactName: string;
  accountName: string | null;
  ownerName: string | null;
};

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function InProgressDealsPanel({
  deals,
  canEdit,
}: {
  deals: InProgressDeal[];
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="mb-4 rounded-xl border border-gold-deep/30 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-ink">Negociações em andamento</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Negócios abertos, dos mais recentes aos mais antigos
          </p>
        </div>
        {deals.length > 0 && (
          <span className="flex-none rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">
            {deals.length}
          </span>
        )}
      </div>

      {deals.length === 0 ? (
        <p className="text-[11.5px] text-ink-faint">Nenhuma negociação em andamento no momento.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {deals.map((deal) => (
            <button
              key={deal.id}
              onClick={() => setOpenId(deal.id)}
              className="flex items-center justify-between gap-3 rounded-lg border border-gold-deep/25 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-gold-deep/60"
            >
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold text-ink">{deal.name}</div>
                <div className="truncate text-[11px] text-ink-faint">
                  {deal.accountName ?? deal.contactName} · {deal.stageName}
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="text-[12.5px] font-bold text-gold-bright">{currency(deal.value)}</div>
                <div className="text-[10.5px] text-ink-faint">{deal.ownerName}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {openId && <DealDetailModal dealId={openId} canEdit={canEdit} onClose={() => setOpenId(null)} />}
    </div>
  );
}
