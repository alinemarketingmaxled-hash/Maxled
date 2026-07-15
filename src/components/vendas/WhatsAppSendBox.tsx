"use client";

import { useState } from "react";

function buildWaLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function WhatsAppSendBox({ phone }: { phone: string | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  if (!phone) return null;

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
          Mensagem por WhatsApp
        </span>
        <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink">
          ×
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escreva a mensagem (opcional)…"
        rows={2}
        className="w-full rounded-md border border-gold-deep/40 bg-surface-3 px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-gold"
      />
      <div className="mt-2 flex items-center gap-2">
        <a
          href={buildWaLink(phone, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-good/15 px-3 py-1.5 text-[11.5px] font-semibold text-good transition-colors hover:bg-good/25"
        >
          Abrir no WhatsApp
        </a>
      </div>
    </div>
  );
}
