"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startMfaSetupAction,
  confirmMfaSetupAction,
  disableMfaAction,
} from "@/app/(app)/meu-perfil/actions";

export function MfaSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startMfaSetupAction();
      setSetup(result);
    });
  }

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!setup) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmMfaSetupAction(setup.secret, code);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSetup(null);
      setCode("");
      router.refresh();
    });
  }

  function handleCancel() {
    setSetup(null);
    setCode("");
    setError(null);
  }

  function handleDisable() {
    if (!confirm("Desativar a verificação em duas etapas? Só a senha vai ser exigida no próximo login.")) return;
    startTransition(async () => {
      await disableMfaAction();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold-deep/30 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Verificação em duas etapas</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {enabled
              ? "Ativa: o login pede um código do app autenticador além da senha."
              : "Desativada. Pra mais segurança, ative usando um app autenticador (Google Authenticator, Authy, etc.)."}
          </p>
        </div>
        {enabled ? (
          <button
            type="button"
            onClick={handleDisable}
            disabled={isPending}
            className="flex-none rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical disabled:opacity-60"
          >
            Desativar
          </button>
        ) : (
          !setup && (
            <button
              type="button"
              onClick={handleStart}
              disabled={isPending}
              className="flex-none rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
            >
              {isPending ? "Gerando…" : "Ativar"}
            </button>
          )
        )}
      </div>

      {setup && (
        <form onSubmit={handleConfirm} className="flex flex-col items-start gap-3 border-t border-gold-deep/20 pt-3">
          <p className="text-[12px] text-ink-muted">
            Escaneie o QR code com o app autenticador do seu celular, ou digite a chave manualmente.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrDataUrl} alt="QR code de configuração" className="h-40 w-40 rounded-lg border border-gold-deep/30 bg-white p-2" />
          <code className="rounded-md bg-surface-2 px-2.5 py-1.5 text-[11px] tracking-wider text-ink-muted">
            {setup.secret}
          </code>
          <label className="flex w-full max-w-xs flex-col gap-1 text-xs">
            <span className="text-ink-faint">Digite o código gerado pelo app pra confirmar</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-center text-base tracking-[0.3em] text-ink outline-none focus:border-gold"
            />
          </label>
          {error && (
            <div className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
            >
              {isPending ? "Confirmando…" : "Confirmar e ativar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
