import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getGoalProgress } from "@/lib/analytics";
import { listImportantPosts } from "@/lib/social";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { CircuitBackground } from "@/components/shell/CircuitBackground";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [me, goal, importantPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, avatarUrl: true },
    }),
    getGoalProgress(session),
    listImportantPosts(),
  ]);

  return (
    <div className="relative flex min-h-screen flex-1">
      <CircuitBackground />
      <Sidebar
        role={session.user.role}
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
      />
      <div className="relative z-10 flex flex-1 flex-col">
        <Topbar
          name={me?.name ?? session.user.name ?? session.user.email ?? "Usuário"}
          role={session.user.role}
          avatarUrl={me?.avatarUrl ?? null}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
