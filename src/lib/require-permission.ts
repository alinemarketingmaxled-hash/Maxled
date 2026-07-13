import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canView, type Module } from "@/lib/permissions";

/** Re-checks module access server-side even if the user reaches the URL directly. */
export async function requireView(mod: Module) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canView(session.user.role, mod)) redirect("/");
  return session;
}
