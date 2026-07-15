"use client";

import { useState, useTransition } from "react";
import type { SalesInsights } from "@/lib/ai";
import { generateInsightsAction } from "@/app/(app)/ia/actions";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PRIORITY_STYLE: Record<string, string> = {
  alta: "bg-critical/15 text-critical",
  média: "bg-warning/15 text-warning",
  baixa: "bg-info/15 text-info",
};

export function InsightsPanel({ disabled }: { disabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [insights, setInsights] = useState<SalesInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateInsightsAction();
      if (result.error) setError(result.error);
      else if (result.data) setInsights(result.data);
    });
  }

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-ink">Previsão &amp; oportunidades</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Previsão de vendas, negócios que precisam de atenção e sugestões de cross-sell —
            baseado nos seus dados reais no CRM.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={disabled || isPending}
          className="flex-none rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Gerando…" : "Gerar insights com IA"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
          {error}
        </div>
      )}

      {!insights && !error && (
        <p className="text-[12.5px] text-ink-faint">
          Clique em &quot;Gerar insights com IA&quot; para analisar seus negócios em aberto.
        </p>
      )}

      {insights && (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-gold-deep/25 bg-surface-2 p-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
                Previsão próximo mês
              </span>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] font-semibold text-ink-muted">
                confiança {insights.forecast.confidence}
              </span>
            </div>
            <div className="mt-1 text-xl font-bold text-gold-bright">
              {currency(insights.forecast.value)}
            </div>
            <p className="mt-1 text-[12px] text-ink-muted">{insights.forecast.reasoning}</p>
          </div>

          <div>
            <h4 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Negócios que precisam de atenção
            </h4>
            {insights.alerts.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Nenhum alerta no momento.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {insights.alerts.map((a) => (
                  <div
                    key={a.dealId}
                    className="flex items-start gap-3 rounded-lg border border-gold-deep/25 bg-surface-2 p-3"
                  >
                    <span
                      className={`mt-0.5 flex-none rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[a.priority] ?? PRIORITY_STYLE.baixa}`}
                    >
                      {a.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-ink">{a.dealName}</span>
                        <span className="flex-none text-[12.5px] font-bold text-gold-bright">
                          {currency(a.value)}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-faint">{a.contactName}</div>
                      <p className="mt-1 text-[12px] text-ink-muted">{a.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Oportunidades de cross-sell
            </h4>
            {insights.crossSell.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Nenhuma sugestão no momento.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {insights.crossSell.map((c) => (
                  <div
                    key={c.contactId}
                    className="rounded-lg border border-gold-deep/25 bg-surface-2 p-3"
                  >
                    <div className="text-[13px] font-semibold text-ink">{c.contactName}</div>
                    <p className="mt-1 text-[12px] text-ink-muted">{c.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gold/40 bg-gold/10 p-3.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-gold-bright">
              Dica estratégica
            </span>
            <p className="mt-1 text-[12.5px] text-ink">{insights.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
