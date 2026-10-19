import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";

/** Opções dos selects do formulário de programação. */
export async function loadScheduleFormOptions(session: Session, companyId: string) {
  const own = getPermission(session.user.role, "programacao").scope === "own";
  const [contacts, products, users] = await Promise.all([
    prisma.contact.findMany({
      where: { deletedAt: null, ...(own ? { ownerId: session.user.id } : {}) },
      orderBy: [{ accountName: "asc" }, { firstName: "asc" }],
      take: 3000,
      select: { id: true, firstName: true, lastName: true, accountName: true },
    }),
    prisma.product.findMany({
      where: { companyId, deletedAt: null, active: true },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true },
    }),
    own
      ? Promise.resolve([])
      : prisma.user.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    ownScope: own,
    contacts: contacts.map((c) => ({ id: c.id, label: c.accountName || `${c.firstName} ${c.lastName}` })),
    products: products.map((p) => ({ id: p.id, label: `${p.sku} · ${p.name}` })),
    users: users.map((u) => ({ id: u.id, label: u.name })),
  };
}
