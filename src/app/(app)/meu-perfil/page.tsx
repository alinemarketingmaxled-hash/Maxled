import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MyProfileForm } from "@/components/perfil/MyProfileForm";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Gerente",
  SELLER: "Vendedor",
  SUPPORT: "Suporte",
  MEDIATOR: "Mediador",
};

export default async function MeuPerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, jobTitle: true, avatarUrl: true, email: true, role: true },
  });

  return (
    <div className="max-w-lg">
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Meu perfil</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {user.email} · {ROLE_LABELS[user.role] ?? user.role}
        </p>
      </div>
      <MyProfileForm user={user} />
    </div>
  );
}
