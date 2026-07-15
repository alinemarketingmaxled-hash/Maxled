import Link from "next/link";
import type { Role } from "@/generated/prisma/client";
import { canView } from "@/lib/permissions";
import { NAV_ITEMS } from "@/components/shell/nav-items";

const SUBTITLES: Record<string, string> = {
  vendas: "Cadastro de clientes",
  negocios: "Quadro de negócios",
  agenda: "Calendário e tarefas",
  social: "Mural da equipe",
  ia: "Previsões e alertas",
  perfil: "Vendedores",
  config: "Configurações",
};

export function QuickNav({ role }: { role: Role }) {
  const items = NAV_ITEMS.filter((item) => item.module !== "analitica" && canView(role, item.module));

  if (items.length === 0) return null;

  return (
    <div className="mb-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-gold-deep/30 bg-surface px-3 py-3.5 text-center transition-colors hover:border-gold hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-base text-gold-bright">
            {item.icon}
          </span>
          <span className="text-[12px] font-semibold text-ink">{item.label}</span>
          <span className="text-[10px] text-ink-faint">{SUBTITLES[item.module] ?? ""}</span>
        </Link>
      ))}
    </div>
  );
}
