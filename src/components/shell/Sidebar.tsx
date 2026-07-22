"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { canView } from "@/lib/permissions";
import { Logo } from "@/components/shell/Logo";
import { CommissionWidget, type CommissionSummary } from "@/components/shell/CommissionWidget";
import { ComunicadosWidget, type ImportantPost } from "@/components/shell/ComunicadosWidget";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({
  role,
  commission,
  importantPosts,
  overdueCount,
  open,
  onClose,
}: {
  role: Role;
  commission: CommissionSummary | null;
  importantPosts: ImportantPost[];
  /** Count of overdue tasks/agendamentos for this user's scope — shown as a
   * badge on the Agenda nav item so overdue items act as a site-wide
   * notification, visible from any page, not just Agenda/Início. */
  overdueCount: number;
  /** Drawer visibility below the lg breakpoint. Ignored (always visible) at
   * lg and up, where the sidebar is a normal static column. */
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-none -translate-x-full flex-col gap-6 overflow-y-auto border-r border-gold-deep/35 bg-surface p-3.5 transition-transform duration-200 ease-out lg:relative lg:z-10 lg:w-56 lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center gap-2.5 px-2">
          <Logo size={34} />
          <span className="font-display text-lg tracking-wide">
            Maxled <span className="text-gold-bright">CRM</span>
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="ml-auto text-lg leading-none text-ink-faint hover:text-ink lg:hidden"
          >
            ×
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => canView(role, item.module)).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
                {item.module === "agenda" && overdueCount > 0 && (
                  <span
                    title={`${overdueCount} atrasado(s)`}
                    className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white"
                  >
                    {overdueCount > 99 ? "99+" : overdueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-3">
          <CommissionWidget commission={commission} />
          <ComunicadosWidget posts={importantPosts} />
        </div>

        <div className="mt-auto border-t border-gold-deep/25 px-2 pt-2.5 text-[11px] text-ink-faint">
          Encriptado · Backup diário
        </div>
      </aside>
    </>
  );
}
