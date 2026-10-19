"use client";

import { useActionState } from "react";
import type { AcceptState } from "./actions";

export function AcceptForm({ action }: { action: (prev: AcceptState, fd: FormData) => Promise<AcceptState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  if (state?.ok) {
    return (
      <p role="status" className="accept-ok">
        {state.message}
      </p>
    );
  }
  return (
    <form action={formAction} className="accept-form">
      <label>
        Seu nome completo
        <input name="name" required minLength={3} maxLength={120} autoComplete="name" />
      </label>
      <label className="accept-check">
        <input type="checkbox" name="agree" required /> Li e concordo com os itens, valores e condições desta proposta.
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Aprovar proposta"}
      </button>
      {state && !state.ok && (
        <p role="alert" className="accept-err">
          {state.message}
        </p>
      )}
    </form>
  );
}
