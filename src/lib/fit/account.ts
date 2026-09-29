import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { fitAuth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type FitAccountInfo = { id: string; name: string; email: string };

/** Who is using Maxled Fit right now: a Fit login, or a CRM user (who gets a
 * FitAccount linked to them on first visit, reusing one with the same
 * e-mail if they had signed up on their own before). */
export const currentFitAccount = cache(async (): Promise<FitAccountInfo | null> => {
  const session = await fitAuth();
  if (!session) return null;
  if (session.fitAccountId) {
    const acc = await prisma.fitAccount.findUnique({ where: { id: session.fitAccountId }, select: { id: true, name: true, email: true } });
    return acc;
  }
  // A CRM login: `user` carries a real id and role.
  if (!session.user?.id || !session.user.role) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, deletedAt: true } });
  if (!user || user.deletedAt) return null;
  const linked = await prisma.fitAccount.findUnique({ where: { crmUserId: user.id }, select: { id: true, name: true, email: true } });
  if (linked) return linked;
  const email = user.email.toLowerCase();
  const byEmail = await prisma.fitAccount.findUnique({ where: { email } });
  if (byEmail && !byEmail.crmUserId) {
    return prisma.fitAccount.update({ where: { id: byEmail.id }, data: { crmUserId: user.id }, select: { id: true, name: true, email: true } });
  }
  return prisma.fitAccount.create({
    data: { email: byEmail ? `crm-${user.id}@maxled.local` : email, name: user.name, crmUserId: user.id },
    select: { id: true, name: true, email: true },
  });
});

export async function requireFitAccount(): Promise<FitAccountInfo> {
  const acc = await currentFitAccount();
  if (!acc) redirect("/fit/entrar");
  return acc;
}
