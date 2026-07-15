import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, avatarUrl: true },
  });

  return (
    <div className="relative flex min-h-screen flex-1">
      <CircuitBackground />
      <Sidebar role={session.user.role} />
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
