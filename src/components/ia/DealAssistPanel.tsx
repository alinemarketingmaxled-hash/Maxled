"use client";

import { useState, useTransition } from "react";
import type { DealAssistMode } from "@/lib/ai";
import { generateDealAssistAction } from "@/app/(app)/ia/actions";

export function DealAssistPanel({
  disabled,
  deals,
}: {
  disabled: boolean;
  deals: Array<{ id: string; label: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [dealId, setDealId] = useState(deals[0]?.id ?? "");
  const [mode, setMode] = useState<DealAssistMode>("tips");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    setResult(null);
    setCopied(false);
    startTransition(async () => {
      const res = await generateDealAssistAction(dealId, mode, context);
      if (res.error) setError(res.error);
      else if (res.data) setResult(res.data);
    });
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface p-5">
      <div className="mb-4">
        <h3 className="font-display text-lg text-ink">Assistente de redação &amp; dicas</h3>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          Escolha um negócio para receber dicas estratégicas ou um rascunho de mensagem pronto
          para enviar ao cliente.
        </p>
      </div>

      {deals.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">
          Nenhum negócio em aberto ainda. Crie um em Negócios para usar o assistente.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-gold"
          >
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => setMode("tips")}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                mode === "tips" ? "bg-gold text-black" : "bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              Dicas estratégicas
            </button>
            <button
              onClick={() => setMode("writing")}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                mode === "writing" ? "bg-gold text-black" : "bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              Rascunho de mensagem
            </button>
          </div>

          {mode === "writing" && (
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Contexto para a mensagem (ex: cliente pediu prazo maior, quer saber sobre o pedido, etc.)"
              rows={2}
              className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-gold"
            />
          )}

          <button
            onClick={handleGenerate}
            disabled={disabled || isPending || !dealId}
            className="self-start rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Gerando…" : "Gerar com IA"}
          </button>

          {error && (
            <div className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-gold-deep/25 bg-surface-2 p-3.5">
              <p className="whitespace-pre-wrap text-[12.5px] text-ink">{result}</p>
              {mode === "writing" && (
                <button
                  onClick={handleCopy}
                  className="mt-2 text-[11.5px] font-semibold text-gold-bright hover:text-gold"
                >
                  {copied ? "Copiado!" : "Copiar mensagem"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
