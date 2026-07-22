"use client";

import { useState, useTransition } from "react";
import type { SalesInsights } from "@/lib/ai";
import { generateInsightsAction } from "@/app/(app)/ia/actions";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PRIORITY_STYLE: Record<string, string> = {
  alta: "border-l-critical bg-critical/10 text-critical",
  média: "border-l-warning bg-warning/10 text-warning",
  baixa: "border-l-info bg-info/10 text-info",
};

export function InsightsPanel() {
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
    <div className="relative overflow-hidden rounded-xl border border-gold-deep/30 bg-surface p-5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-gold-deep before:via-gold-bright before:to-gold-deep">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-lg text-gold-bright">
            ✧
          </div>
          <div>
            <h3 className="font-display text-lg text-ink">Previsão &amp; oportunidades</h3>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              Previsão, alertas e cross-sell a partir dos seus dados reais
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex-none rounded-lg bg-gold-solid px-4 py-2 text-xs font-semibold text-black shadow-[0_0_0_1px_rgba(201,162,39,0.4)] transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="rounded-lg border border-dashed border-gold-deep/40 px-4 py-8 text-center">
          <p className="text-[12.5px] text-ink-faint">
            Clique em &quot;Gerar insights com IA&quot; para analisar seus negócios em aberto.
          </p>
        </div>
      )}

      {insights && (
        <div className="flex flex-col gap-5">
          <span
            className={`self-start rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide ${
              insights.source === "ai"
                ? "bg-gold/15 text-gold-bright"
                : "bg-surface-3 text-ink-faint"
            }`}
          >
            {insights.source === "ai" ? "✧ Gerado por IA (Claude)" : "⚙ Análise automática (sem custo)"}
          </span>
          <div className="rounded-lg border border-gold/30 bg-gradient-to-br from-gold/10 via-surface-2 to-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-3 text-base">
                  📈
                </span>
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
                  Previsão próximo mês
                </span>
              </div>
              <span className="flex-none rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] font-semibold text-ink-muted">
                confiança {insights.forecast.confidence}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-gold-bright">
              {currency(insights.forecast.value)}
            </div>
            <p className="mt-1.5 text-[12px] text-ink-muted">{insights.forecast.reasoning}</p>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
              <span>⚠</span> Negócios que precisam de atenção
            </h4>
            {insights.alerts.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Nenhum alerta no momento.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {insights.alerts.map((a) => (
                  <div
                    key={a.dealId}
                    className={`rounded-lg border-l-4 bg-surface-2 p-3 transition-transform hover:-translate-y-0.5 ${PRIORITY_STYLE[a.priority] ?? PRIORITY_STYLE.baixa}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">{a.dealName}</span>
                      <span className="flex-none text-[12.5px] font-bold text-gold-bright">
                        {currency(a.value)}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-faint">{a.contactName}</div>
                    <p className="mt-1 text-[12px] text-ink-muted">{a.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
              <span>🔁</span> Oportunidades de cross-sell
            </h4>
            {insights.crossSell.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Nenhuma sugestão no momento.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {insights.crossSell.map((c) => (
                  <div
                    key={c.contactId}
                    className="rounded-lg border border-gold-deep/25 bg-surface-2 p-3 transition-colors hover:border-gold-deep/60"
                  >
                    <div className="text-[13px] font-semibold text-ink">{c.contactName}</div>
                    <p className="mt-1 text-[12px] text-ink-muted">{c.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-gold/40 bg-gold/10 p-3.5">
            <span className="mt-0.5 flex-none text-base">💡</span>
            <div>
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-gold-bright">
                Dica estratégica
              </span>
              <p className="mt-1 text-[12.5px] text-ink">{insights.tip}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
