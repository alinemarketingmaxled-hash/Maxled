"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type ClientActionResult = { ok: true; message?: string; redirectTo?: string } | { ok: false; error: string };

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Formulário ligado a uma server action que devolve ActionResult. Mostra
 * o erro de regra de negócio inline, atualiza a página no sucesso e manda
 * um `requestKey` único por envio — o servidor usa essa chave para ignorar
 * reenvios (duplo clique, rede instável). */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  confirm,
  successMessage,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [requestKey, setRequestKey] = useState(newKey);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await action(fd);
          if (res.ok) {
            setMsg(res.message || successMessage ? { ok: true, text: res.message || successMessage! } : null);
            setRequestKey(newKey());
            if (resetOnSuccess) formRef.current?.reset();
            if (res.redirectTo) router.push(res.redirectTo);
            router.refresh();
          } else {
            setMsg({ ok: false, text: res.error });
          }
        });
      }}
    >
      <input type="hidden" name="requestKey" value={requestKey} />
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-xs ${msg.ok ? "text-good" : "text-critical"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

/** Botão único de ação (aprovar, emitir, avançar etapa). `prompt` pede um
 * texto obrigatório (ex.: motivo do cancelamento) enviado como "reason". */
export function ActionButton({
  action,
  fields = {},
  children,
  className,
  confirm,
  prompt,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  fields?: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  prompt?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          let reason: string | null = null;
          if (prompt) {
            reason = window.prompt(prompt);
            if (reason === null) return;
          }
          const fd = new FormData();
          for (const [k, v] of Object.entries(fields)) fd.set(k, v);
          if (reason !== null) fd.set("reason", reason);
          fd.set("requestKey", newKey());
          startTransition(async () => {
            const res = await action(fd);
            if (res.ok) {
              setError(null);
              if (res.redirectTo) router.push(res.redirectTo);
              router.refresh();
            } else {
              setError(res.error);
            }
          });
        }}
      >
        {pending ? "Aguarde..." : children}
      </button>
      {error && (
        <span role="alert" className="max-w-xs text-[11px] text-critical">
          {error}
        </span>
      )}
    </span>
  );
}
