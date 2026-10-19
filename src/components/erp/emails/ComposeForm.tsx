"use client";

import { useRef, useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Field, btnPrimary, btnSecondary, inputCls } from "@/components/erp/ui";

type Option = { id: string; label: string };

const MAX_BYTES = 4 * 1024 * 1024;

export type ComposeDefaults = {
  accountId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  contactId: string;
  orderId: string;
  inReplyTo: string;
  draftId: string;
};

export function ComposeForm({
  action,
  accounts,
  contacts,
  orders,
  defaults,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  accounts: Option[];
  contacts: Option[];
  orders: Option[];
  defaults: ComposeDefaults;
}) {
  const intentRef = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input ref={intentRef} type="hidden" name="intent" defaultValue="send" />
      <input type="hidden" name="inReplyTo" value={defaults.inReplyTo} />
      <input type="hidden" name="draftId" value={defaults.draftId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="De">
          <select name="accountId" defaultValue={defaults.accountId} className={inputCls}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Para (separe vários com vírgula)">
          <input name="to" defaultValue={defaults.to} required className={inputCls} />
        </Field>
        <Field label="Cc">
          <input name="cc" defaultValue={defaults.cc} className={inputCls} />
        </Field>
        <Field label="Assunto">
          <input name="subject" defaultValue={defaults.subject} className={inputCls} />
        </Field>
      </div>
      <Field label="Mensagem">
        <textarea name="body" defaultValue={defaults.body} rows={14} className={`${inputCls} font-sans leading-relaxed`} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Anexos (até 4 MB no total)">
          <input
            type="file"
            name="attachments"
            multiple
            className="text-xs text-ink-muted file:mr-2 file:rounded-md file:border file:border-gold-deep file:bg-surface-2 file:px-2.5 file:py-1.5 file:text-xs file:text-ink"
            onChange={(e) => {
              const total = Array.from(e.currentTarget.files ?? []).reduce((s, f) => s + f.size, 0);
              if (total > MAX_BYTES) {
                setSizeError("Anexos acima de 4 MB no total. Remova algum arquivo.");
                e.currentTarget.value = "";
              } else {
                setSizeError(null);
              }
            }}
          />
          {sizeError && <span className="text-[11px] text-critical">{sizeError}</span>}
        </Field>
        <Field label="Cliente">
          <select name="contactId" defaultValue={defaults.contactId} className={inputCls}>
            <option value="">Detectar pelo destinatário</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pedido">
          <select name="orderId" defaultValue={defaults.orderId} className={inputCls}>
            <option value="">Nenhum</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className={btnPrimary}
          onClick={() => {
            if (intentRef.current) intentRef.current.value = "send";
          }}
        >
          Enviar
        </button>
        <button
          type="submit"
          className={btnSecondary}
          onClick={() => {
            if (intentRef.current) intentRef.current.value = "draft";
          }}
        >
          Salvar rascunho
        </button>
      </div>
    </ActionForm>
  );
}
