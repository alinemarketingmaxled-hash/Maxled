function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export type CommissionSummary = {
  achieved: number;
  dealsWon: number;
  goal1: number | null;
  commissionEarned: number;
  effectiveCommissionPct: number | null;
};

/** Left-nav "Comissão" widget — faturamento/meta/negócios/comissão do mês
 * corrente do usuário logado, sempre visível (não só na Início). */
export function CommissionWidget({ commission }: { commission: CommissionSummary | null }) {
  if (!commission) return null;
  const pct = commission.goal1 ? Math.min(100, Math.round((commission.achieved / commission.goal1) * 100)) : null;

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface-2 p-3">
      <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">Comissão</h4>
      <div className="text-[10.5px] text-ink-faint">Faturamento</div>
      <div className="text-[17px] font-bold text-gold-bright">{currency(commission.achieved)}</div>

      {commission.goal1 != null && pct !== null && (
        <>
          <div className="mt-1 text-[10px] text-ink-faint">Meta: {currency(commission.goal1)}</div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gold-solid transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-0.5 text-right text-[10px] text-ink-faint">{pct}%</div>
        </>
      )}

      <div className="mt-2 flex justify-between border-t border-dashed border-gold-deep/25 pt-1.5 text-[11px]">
        <span className="text-ink-faint">Negócios</span>
        <span className="font-semibold text-ink">{commission.dealsWon}</span>
      </div>
      <div className="mt-1 flex justify-between text-[11px]">
        <span className="text-ink-faint">
          Comissão
          {commission.effectiveCommissionPct !== null && ` (${commission.effectiveCommissionPct.toFixed(2)}%)`}
        </span>
        <span className="font-semibold text-gold-bright">{currency(commission.commissionEarned)}</span>
      </div>
    </div>
  );
}
