import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Sessão do Portal do cliente revalidada no servidor a cada uso: role
 * CUSTOMER, conta ativa e vinculada ao mesmo contato do token. Toda consulta
 * do portal filtra por esse contactId — nunca por um id vindo da URL. */
export async function requireCustomer() {
  const session = await auth();
  if (!session?.user) redirect("/portal/login");
  if (session.user.role !== "CUSTOMER") redirect("/");
  const contactId = session.user.contactId;
  const portalUser = await prisma.portalUser.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, active: true, lockedAt: true, contactId: true,
      contact: { select: { deletedAt: true } },
    },
  });
  if (!contactId || !portalUser || !portalUser.active || portalUser.lockedAt || portalUser.contactId !== contactId || portalUser.contact.deletedAt) {
    redirect("/portal/login?sessao=invalida");
  }
  return { session, contactId, portalUser };
}

export { PORTAL_STATUS_LABELS, PORTAL_EVENT_LABELS, REQUEST_TYPE_LABELS, companyLabel } from "@/lib/erp/portal-labels";
