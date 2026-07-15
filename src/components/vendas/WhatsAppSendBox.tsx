"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendContactWhatsAppAction } from "@/app/(app)/vendas/actions";

export function WhatsAppSendBox({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    if (!message.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await sendContactWhatsAppAction(contactId, message);
      if (res.error) {
        setError(res.error);
      } else {
        setSent(true);
        setMessage("");
        router.refresh();
        setTimeout(() => {
          setSent(false);
          setOpen(false);
        }, 1500);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:text-gold-bright"
      >
        📲 Enviar mensagem por WhatsApp
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-gold-deep/30 bg-surface-2 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
          Enviar WhatsApp (Netsapp)
        </span>
        <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink">
          ×
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escreva a mensagem…"
        rows={2}
        className="w-full rounded-md border border-gold-deep/40 bg-surface-3 px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-gold"
      />
      {error && <p className="mt-1.5 text-[11.5px] text-critical">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={handleSend}
          disabled={isPending || !message.trim()}
          className="rounded-md bg-good/15 px-3 py-1.5 text-[11.5px] font-semibold text-good transition-colors hover:bg-good/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Enviando…" : sent ? "Enviado ✓" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
