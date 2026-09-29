"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CameraI, DumbbellI, HomeI, PlayI, PlusI, ScaleI, SparkI, UserI } from "./FitIcons";

const ITEMS = [
  { href: "/fit", label: "Início", icon: HomeI },
  { href: "/fit/treino", label: "Treino", icon: DumbbellI },
  null,
  { href: "/fit/bio", label: "Bio", icon: ScaleI },
  { href: "/fit/perfil", label: "Perfil", icon: UserI },
] as const;

/** Bottom tab bar with the raised "+" button from the design. The "+"
 * opens a quick-action sheet: start today's workout or log a new bio. */
export function FitNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname.startsWith("/fit/comecar") || pathname.startsWith("/fit/entrar") || pathname.startsWith("/fit/cadastro") || pathname.endsWith("/play")) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="fit-rise absolute inset-x-0 bottom-28 mx-auto flex w-full max-w-md flex-col gap-2 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <QuickAction href="/fit/hoje" icon={<PlayI className="h-5 w-5" />} title="Começar treino de hoje" hint="Abre o treino do dia" onClick={() => setOpen(false)} />
            <QuickAction href="/fit/alongamento" icon={<SparkI className="h-5 w-5" />} title="Alongamento" hint="Antes e depois do treino, com fotos" onClick={() => setOpen(false)} />
            <QuickAction href="/fit/bio/nova?modo=laudo" icon={<CameraI className="h-5 w-5" />} title="Foto do laudo de bioimpedância" hint="A IA lê os valores para você" onClick={() => setOpen(false)} />
            <QuickAction href="/fit/bio/nova?modo=foto" icon={<UserI className="h-5 w-5" />} title="Foto do corpo" hint="Estimativa de % de gordura" onClick={() => setOpen(false)} />
            <QuickAction href="/fit/bio/nova?modo=manual" icon={<ScaleI className="h-5 w-5" />} title="Digitar bioimpedância" hint="Peso, gordura, músculo, medidas" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]" aria-label="Navegação do Fit">
        <div className="mx-auto mb-3 flex h-[68px] w-[calc(100%-2rem)] max-w-[416px] items-center justify-around rounded-[26px] bg-fit-strong px-2 text-white shadow-2xl shadow-black/40">
          {ITEMS.map((item) => {
            if (!item) {
              return (
                <button
                  key="plus"
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-label="Ações rápidas"
                  aria-expanded={open}
                  className={`grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-fit-lime text-fit-on-lime shadow-lg shadow-black/40 ring-4 ring-fit-bg transition-transform ${open ? "rotate-45" : ""}`}
                >
                  <PlusI className="h-6 w-6" strokeWidth={2.5} />
                </button>
              );
            }
            const active = item.href === "/fit" ? pathname === "/fit" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex w-14 flex-col items-center gap-1 text-[10px] font-medium ${active ? "text-[#d6f94b]" : "text-white/55 hover:text-white"}`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function QuickAction({ href, icon, title, hint, onClick }: { href: string; icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3 rounded-3xl bg-fit-card p-3 pr-4 text-fit-ink">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-fit-lime text-fit-on-lime">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-fit-muted">{hint}</span>
      </span>
    </Link>
  );
}
