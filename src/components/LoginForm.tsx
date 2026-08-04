"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // NextAuth's client stringifies an explicit `code: undefined` into the
    // literal text "undefined" instead of omitting it, so the field is only
    // included at all once we're actually on the MFA step.
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      ...(mfaStep ? { code } : {}),
    });

    setLoading(false);

    if (result?.error) {
      if (result.code === "mfa_required") {
        setMfaStep(true);
        return;
      }
      if (result.code === "mfa_invalid") {
        setError("Código de verificação incorreto. Confira o app autenticador e tente de novo.");
        return;
      }
      setError(
        result.code === "account_locked"
          ? "Conta bloqueada após várias tentativas incorretas. Peça para o Mediador liberar seu acesso em Perfil."
          : "E-mail ou senha incorretos.",
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (mfaStep) {
    return (
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <p className="text-xs text-ink-muted">
          Abra o app autenticador no seu celular e digite o código de 6 dígitos.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Código de verificação
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-gold-deep/50 bg-surface-2 px-3 py-2.5 text-center text-lg tracking-[0.3em] text-ink outline-none focus:border-gold"
          />
        </div>
        {error && <p className="text-xs text-critical">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-gold-solid px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:opacity-60"
        >
          {loading ? "Verificando…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMfaStep(false);
            setCode("");
            setError(null);
          }}
          className="text-xs text-ink-faint hover:text-ink"
        >
          Voltar
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-gold-deep/50 bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-gold-deep/50 bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold"
        />
      </div>
      {error && <p className="text-xs text-critical">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-lg bg-gold-solid px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
