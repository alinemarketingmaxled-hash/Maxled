"use client";

import { useState, useTransition } from "react";
import type { DealAssistMode } from "@/lib/ai";
import { generateDealAssistAction } from "@/app/(app)/ia/actions";

export function DealAssistPanel({
  disabled,
  deals,
}: {
  disabled: boolean;
  deals: Array<{ id: string; label: string; phone: string | null }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [dealId, setDealId] = useState(deals[0]?.id ?? "");
  const [mode, setMode] = useState<DealAssistMode>("tips");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedDeal = deals.find((d) => d.id === dealId);

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

  function handleOpenWhatsApp() {
    if (!result || !selectedDeal?.phone) return;
    const digits = selectedDeal.phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(result)}`, "_blank");
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-gold-deep/30 bg-surface p-5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-gold-deep before:via-gold-bright before:to-gold-deep">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-lg text-gold-bright">
          ✎
        </div>
        <div>
          <h3 className="font-display text-lg text-ink">Assistente de redação &amp; dicas</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Dicas estratégicas ou rascunho de mensagem, para um negócio específico
          </p>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gold-deep/40 px-4 py-8 text-center">
          <p className="text-[12.5px] text-ink-faint">
            Nenhum negócio em aberto ainda. Crie um em Negócios para usar o assistente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2.5 text-[12.5px] text-ink outline-none focus:border-gold"
          >
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>

          <div className="flex gap-1.5 rounded-lg bg-surface-2 p-1">
            <button
              onClick={() => setMode("tips")}
              className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                mode === "tips" ? "bg-gold text-black" : "text-ink-muted hover:text-ink"
              }`}
            >
              💡 Dicas estratégicas
            </button>
            <button
              onClick={() => setMode("writing")}
              className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                mode === "writing" ? "bg-gold text-black" : "text-ink-muted hover:text-ink"
              }`}
            >
              ✉ Rascunho de mensagem
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
            className="self-start rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black shadow-[0_0_0_1px_rgba(201,162,39,0.4)] transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Gerando…" : "Gerar com IA"}
          </button>

          {error && (
            <div className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-gold/30 bg-gradient-to-br from-gold/10 via-surface-2 to-surface-2 p-3.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-bright">
                <span>✨</span> Resultado
              </div>
              <p className="whitespace-pre-wrap text-[12.5px] text-ink">{result}</p>
              {mode === "writing" && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="rounded-md bg-surface-3 px-2.5 py-1 text-[11.5px] font-semibold text-gold-bright transition-colors hover:text-gold"
                  >
                    {copied ? "Copiado!" : "Copiar mensagem"}
                  </button>
                  <button
                    onClick={handleOpenWhatsApp}
                    disabled={!selectedDeal?.phone}
                    title={!selectedDeal?.phone ? "Este cliente não tem telefone cadastrado" : undefined}
                    className="rounded-md bg-good/15 px-2.5 py-1 text-[11.5px] font-semibold text-good transition-colors hover:bg-good/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    📲 Abrir no WhatsApp
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
