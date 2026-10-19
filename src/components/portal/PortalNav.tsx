"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/portal", label: "Início" },
  { href: "/portal/pedidos", label: "Pedidos" },
  { href: "/portal/documentos", label: "Documentos" },
  { href: "/portal/financeiro", label: "Financeiro" },
  { href: "/portal/programacoes", label: "Programações" },
  { href: "/portal/solicitacoes", label: "Solicitações" },
];

export function PortalNav({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/portal" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Abrir menu"
        className="ml-auto rounded-md border border-gold-deep/50 px-3 py-1.5 text-xs font-semibold text-ink md:hidden"
      >
        Menu
      </button>
      <nav
        className={`${open ? "flex" : "hidden"} w-full flex-col gap-1 md:ml-auto md:flex md:w-auto md:flex-row md:items-center`}
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={`rounded-lg px-3 py-2 text-[13px] transition-colors ${
              isActive(l.href) ? "bg-gold-solid font-semibold text-black" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        ))}
        <form action={signOutAction}>
          <button type="submit" className="w-full rounded-lg border border-gold-deep px-3 py-1.5 text-left text-xs font-semibold text-ink hover:border-gold md:ml-2 md:w-auto">
            Sair
          </button>
        </form>
      </nav>
    </>
  );
}
