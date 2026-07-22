import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getGoalProgress } from "@/lib/analytics";
import { listImportantPosts } from "@/lib/social";
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

  const [me, goal, importantPosts, overdueCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, avatarUrl: true },
    }),
    getGoalProgress(session),
    listImportantPosts(),
    getOverdueTaskCount(session),
    healProspectStages(),
  ]);

  return (
    <AppShell
      role={session.user.role}
      name={me?.name ?? session.user.name ?? session.user.email ?? "Usuário"}
      avatarUrl={me?.avatarUrl ?? null}
      overdueCount={overdueCount}
      commission={
        goal
          ? {
              achieved: goal.achieved,
              dealsWon: goal.dealsWon,
              goal1: goal.goal1,
              commissionEarned: goal.commissionEarned,
              effectiveCommissionPct: goal.effectiveCommissionPct,
            }
          : null
      }
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
