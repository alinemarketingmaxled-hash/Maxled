import type { Module } from "@/lib/permissions";

export const NAV_ITEMS: { href: string; label: string; module: Module; icon: string }[] = [
  { href: "/", label: "Início", module: "analitica", icon: "◆" },
  { href: "/vendas", label: "Clientes", module: "vendas", icon: "☎" },
  { href: "/negocios", label: "Negócios", module: "negocios", icon: "▦" },
  { href: "/agenda", label: "Agenda", module: "agenda", icon: "◷" },
  { href: "/social", label: "Comunicados", module: "social", icon: "✦" },
  { href: "/ia", label: "IA", module: "ia", icon: "✧" },
  { href: "/perfil", label: "Perfil", module: "perfil", icon: "⬢" },
  { href: "/config", label: "Config", module: "config", icon: "⚙" },
];
