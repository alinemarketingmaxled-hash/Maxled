import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";

function scopeWhere(session: Session, mod: "vendas" | "negocios") {
  const { scope } = getPermission(session.user.role, mod);
  return scope === "own" ? { ownerId: session.user.id } : {};
}

export type SearchResult = {
  contacts: { id: string; name: string; accountName: string | null }[];
  deals: { id: string; name: string; value: number }[];
};

/** Backs the topbar search — small, fast, name-only lookup across Clientes
 * and Negócios, scoped the same way each module's own list already is. */
export async function search(session: Session, query: string): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) return { contacts: [], deals: [] };

  const [contacts, deals] = await Promise.all([
    prisma.contact.findMany({
      where: {
        deletedAt: null,
        ...scopeWhere(session, "vendas"),
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { accountName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, accountName: true },
      take: 6,
    }),
    prisma.deal.findMany({
      where: {
        deletedAt: null,
        ...scopeWhere(session, "negocios"),
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true, value: true },
      take: 6,
    }),
  ]);

  return {
    contacts: contacts.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      accountName: c.accountName,
    })),
    deals: deals.map((d) => ({ id: d.id, name: d.name, value: Number(d.value) })),
  };
}
