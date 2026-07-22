"use client";

import { useState } from "react";
import type { Role } from "@/generated/prisma/client";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { CircuitBackground } from "@/components/shell/CircuitBackground";
import type { CommissionSummary } from "@/components/shell/CommissionWidget";
import type { ImportantPost } from "@/components/shell/ComunicadosWidget";

/** Owns the mobile drawer state so the hamburger button (in Topbar) and the
 * sidebar it opens (a separate element in the tree) can share it. On
 * desktop (lg+) the sidebar is always visible and this state is unused. */
export function AppShell({
  role,
  name,
  avatarUrl,
  commission,
  importantPosts,
  children,
}: {
  role: Role;
  name: string;
  avatarUrl: string | null;
  commission: CommissionSummary | null;
  importantPosts: ImportantPost[];
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-1">
      <CircuitBackground />
      <Sidebar
        role={role}
        commission={commission}
        importantPosts={importantPosts}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar name={name} role={role} avatarUrl={avatarUrl} onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 overflow-x-hidden p-3.5 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
