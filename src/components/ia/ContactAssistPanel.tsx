"use client";

import { useState, useTransition } from "react";
import type { ContactAssistMode, ContactAssistResult } from "@/lib/ai";
import { generateContactAssistAction } from "@/app/(app)/ia/actions";

export function ContactAssistPanel({
  contacts,
}: {
  contacts: Array<{ id: string; label: string; phone: string | null }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [mode, setMode] = useState<ContactAssistMode>("analysis");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<ContactAssistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedContact = contacts.find((c) => c.id === contactId);

  function handleGenerate() {
    setError(null);
    setResult(null);
    setCopied(false);
    startTransition(async () => {
      const res = await generateContactAssistAction(contactId, mode, context);
      if (res.error) setError(res.error);
      else if (res.data) setResult(res.data);
    });
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenWhatsApp() {
    if (!result || !selectedContact?.phone) return;
    const digits = selectedContact.phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(result.text)}`, "_blank");
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-gold-deep/30 bg-surface p-5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-gold-deep before:via-gold-bright before:to-gold-deep">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-lg text-gold-bright">
          👤
        </div>
        <div>
          <h3 className="font-display text-lg text-ink">Assistente por cliente</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Análise ou rascunho de mensagem, com base no cadastro e histórico de um cliente
          </p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gold-deep/40 px-4 py-8 text-center">
          <p className="text-[12.5px] text-ink-faint">
            Nenhum cliente cadastrado ainda. Cadastre um em Clientes para usar o assistente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2.5 text-[12.5px] text-ink outline-none focus:border-gold"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <div className="flex gap-1.5 rounded-lg bg-surface-2 p-1">
            <button
              onClick={() => setMode("analysis")}
              className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                mode === "analysis" ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"
              }`}
            >
              🔍 Análise do cliente
            </button>
            <button
              onClick={() => setMode("writing")}
              className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                mode === "writing" ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"
              }`}
            >
              ✉ Rascunho de mensagem
            </button>
          </div>

          {mode === "writing" && (
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Contexto para a mensagem (ex: promoção nova, aniversário, retomar contato, etc.)"
              rows={2}
              className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-gold"
            />
          )}

          <button
            onClick={handleGenerate}
            disabled={isPending || !contactId}
            className="self-start rounded-lg bg-gold-solid px-4 py-2 text-xs font-semibold text-black shadow-[0_0_0_1px_rgba(201,162,39,0.4)] transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
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
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-bright">
                  <span>✨</span> Resultado
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    result.source === "ai" ? "bg-gold/15 text-gold-bright" : "bg-surface-3 text-ink-faint"
                  }`}
                >
                  {result.source === "ai" ? "IA (Claude)" : "Automático"}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[12.5px] text-ink">{result.text}</p>
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
                    disabled={!selectedContact?.phone}
                    title={!selectedContact?.phone ? "Este cliente não tem telefone cadastrado" : undefined}
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
