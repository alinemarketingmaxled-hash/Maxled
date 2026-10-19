import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canView, canEdit, landingFor, type Module } from "@/lib/permissions";

/** Re-checks module access server-side even if the user reaches the URL directly. */
export async function requireView(mod: Module) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CUSTOMER") redirect("/portal");
  if (!canView(session.user.role, mod)) {
    const landing = landingFor(session.user.role);
    // Never bounce back onto a page the role also can't see.
    redirect(landing === "/" && mod === "analitica" ? "/painel" : landing);
  }
  return session;
}

/** For server actions: throws instead of redirecting, so a direct POST
 * without permission fails loudly rather than silently navigating. */
export async function requireEditAction(mod: Module) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit(session.user.role, mod)) {
    throw new Error("Sem permissão para esta operação.");
  }
  return session;
}

export async function requireViewAction(mod: Module) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canView(session.user.role, mod)) {
    throw new Error("Sem permissão para esta operação.");
  }
  return session;
}
