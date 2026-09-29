"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { signUpFitAction } from "@/app/fit/actions";
import { ArrowRightI, DumbbellI } from "./FitIcons";

export function FitAuthForm({ mode }: { mode: "entrar" | "cadastro" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const signup = mode === "cadastro";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (signup && password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    start(async () => {
      if (signup) {
        const res = await signUpFitAction({ name, email, password });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      const result = await signIn("fit", { email, password, redirect: false });
      if (result?.error) {
        setError(
          result.code === "account_locked"
            ? "Conta bloqueada após várias tentativas. Fale com o suporte Maxled para liberar."
            : "E-mail ou senha incorretos.",
        );
        return;
      }
      router.push(signup ? "/fit/comecar" : "/fit");
      router.refresh();
    });
  }

  const input = "h-14 w-full rounded-2xl bg-fit-card px-4 text-base outline-none ring-fit-lime focus:ring-2";

  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-fit-lime text-fit-on-lime">
          <DumbbellI className="h-6 w-6" />
        </span>
        <span className="text-xl font-bold">
          Maxled <span className="text-fit-accent">Fit</span>
        </span>
      </div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight">{signup ? "Crie sua conta" : "Bem-vindo de volta"}</h1>
      <p className="mt-2 text-sm text-fit-muted">
        {signup ? "Seu treino, suas bioimpedâncias e seu histórico ficam salvos na sua conta." : "Entre para ver seu treino de hoje."}
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        {signup && (
          <label className="block">
            <span className="mb-1.5 block text-xs text-fit-muted">Nome</span>
            <input id="fit-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs text-fit-muted">E-mail</span>
          <input id="fit-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1.5 flex justify-between text-xs text-fit-muted">
            Senha
            <button type="button" onClick={() => setShowPw((v) => !v)} className="text-fit-accent">
              {showPw ? "Ocultar" : "Mostrar"}
            </button>
          </span>
          <input
            id="fit-password"
            type={showPw ? "text" : "password"}
            required
            minLength={signup ? 8 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
        </label>
        {signup && (
          <label className="block">
            <span className="mb-1.5 block text-xs text-fit-muted">Confirme a senha</span>
            <input
              id="fit-confirm"
              type={showPw ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={input}
            />
            <span className="mt-1 block text-[11px] text-fit-faint">Mínimo de 8 caracteres.</span>
          </label>
        )}
        {error && <p className="rounded-2xl bg-fit-bad/15 p-3 text-sm text-fit-bad">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex h-14 items-center justify-center gap-2 rounded-full bg-fit-lime text-base font-semibold text-fit-on-lime disabled:opacity-60"
        >
          {pending ? "Aguarde..." : signup ? "Criar conta" : "Entrar"} <ArrowRightI className="h-5 w-5" />
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-fit-muted">
        {signup ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link href={signup ? "/fit/entrar" : "/fit/cadastro"} className="font-semibold text-fit-accent">
          {signup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
      {!signup && (
        <p className="mt-3 text-center text-xs text-fit-faint">
          Usa o CRM Maxled?{" "}
          <Link href="/login?callbackUrl=/fit" className="underline">
            Entre com a conta do CRM
          </Link>
        </p>
      )}
    </div>
  );
}
