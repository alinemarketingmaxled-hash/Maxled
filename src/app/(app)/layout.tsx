import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getGoalProgress } from "@/lib/analytics";
import { listImportantPosts, getUnreadPostCount } from "@/lib/social";
import { healProspectStages } from "@/lib/prospect-stages";
import { getOverdueTaskCount } from "@/lib/tasks";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [me, goal, importantPosts, overdueCount, unreadPostCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, avatarUrl: true },
    }),
    getGoalProgress(session),
    listImportantPosts(),
    getOverdueTaskCount(session),
    getUnreadPostCount(session),
    healProspectStages(),
  ]);

  return (
    <AppShell
      role={session.user.role}
      name={me?.name ?? session.user.name ?? session.user.email ?? "Usuário"}
      avatarUrl={me?.avatarUrl ?? null}
      overdueCount={overdueCount}
      unreadPostCount={unreadPostCount}
      commission={{
        achieved: goal?.achieved ?? 0,
        dealsWon: goal?.dealsWon ?? 0,
        goal1: goal?.goal1 ?? null,
        commissionEarned: goal?.commissionEarned ?? 0,
        effectiveCommissionPct: goal?.effectiveCommissionPct ?? null,
      }}
      importantPosts={importantPosts.map((p) => ({
        id: p.id,
        body: p.body,
        authorName: p.authorName,
        createdAt: p.createdAt.toISOString(),
      }))}
    >
      {children}
    </AppShell>
  );
}
