import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { associationScope } from "@/lib/erp/mail";
import { orderCode } from "@/lib/erp/format";

/** Opções de vínculo (cliente/pedido) mostradas nos formulários de e-mail,
 * limitadas à carteira do usuário na empresa ativa. */
export async function associationOptions(session: Session, companyId: string | null) {
  const scope = companyId ? associationScope(session, companyId) : { contactWhere: null, orderWhere: null };
  const [contacts, orders] = await Promise.all([
    scope.contactWhere
      ? prisma.contact.findMany({
          where: scope.contactWhere,
          orderBy: [{ accountName: "asc" }, { firstName: "asc" }],
          take: 500,
          select: { id: true, firstName: true, lastName: true, accountName: true },
        })
      : Promise.resolve([]),
    scope.orderWhere
      ? prisma.salesOrder.findMany({
          where: scope.orderWhere,
          orderBy: { number: "desc" },
          take: 200,
          select: { id: true, number: true, company: { select: { code: true } }, contact: { select: { firstName: true, lastName: true, accountName: true } } },
        })
      : Promise.resolve([]),
  ]);
  return {
    contacts: contacts.map((c) => ({ id: c.id, label: c.accountName ? `${c.accountName} (${c.firstName} ${c.lastName})` : `${c.firstName} ${c.lastName}` })),
    orders: orders.map((o) => ({
      id: o.id,
      label: `${orderCode(o.company.code, o.number)} · ${o.contact.accountName || `${o.contact.firstName} ${o.contact.lastName}`}`,
    })),
  };
}
