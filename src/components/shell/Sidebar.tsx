"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { canView } from "@/lib/permissions";
import { Logo } from "@/components/shell/Logo";
import { CommissionWidget, type CommissionSummary } from "@/components/shell/CommissionWidget";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ role, commission }: { role: Role; commission: CommissionSummary | null }) {
  const pathname = usePathname();

  return (
    <aside className="relative z-10 flex w-56 flex-none flex-col gap-6 border-r border-gold-deep/35 bg-surface p-3.5">
      <div className="flex items-center gap-2.5 px-2">
        <Logo size={34} />
        <span className="font-display text-lg tracking-wide">
          Maxled <span className="text-gold-bright">CRM</span>
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.filter((item) => canView(role, item.module)).map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-[13.5px] transition-colors ${
                active
                  ? "border-gold bg-surface-2 text-gold-bright"
                  : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span className="w-[18px] flex-none opacity-90">{item.icon}</span>
              {item.label}
              {item.module === "perfil" && role === "MEDIATOR" && (
                <span className="ml-auto rounded-full bg-gold-deep px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-ink">
                  Mediador
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <CommissionWidget commission={commission} />

      <div className="mt-auto border-t border-gold-deep/25 px-2 pt-2.5 text-[11px] text-ink-faint">
        Encriptado · Backup diário
      </div>
    </aside>
  );
}
