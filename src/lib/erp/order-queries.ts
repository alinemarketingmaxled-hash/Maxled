import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission } from "@/lib/permissions";
import { orderContactScope } from "@/lib/erp/orders";
import { availabilityFor } from "@/lib/erp/stock";
import type { QuoteFormContact, QuoteFormProduct, QuoteFormSeller } from "@/components/erp/pedidos/QuoteForm";

/** Tudo que o formulário de cotação precisa, já serializado (Decimal →
 * number) para atravessar a fronteira server → client. */
export async function loadQuoteFormData(session: Session, companyId: string) {
  const ownScope = getPermission(session.user.role, "pedidos").scope === "own";
  const [contacts, products, sellers] = await Promise.all([
    prisma.contact.findMany({
      where: orderContactScope(session),
      orderBy: [{ accountName: "asc" }, { firstName: "asc" }],
      take: 3000,
      select: {
        id: true, firstName: true, lastName: true, accountName: true, cnpj: true, ownerId: true,
        street: true, number: true, city: true, state: true, postalCode: true, enderecoEntrega: true,
      },
    }),
    prisma.product.findMany({
      where: { companyId, active: true, deletedAt: null },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, unit: true, kind: true, price: true, minPrice: true, _count: { select: { components: true } } },
    }),
    ownScope
      ? Promise.resolve([])
      : prisma.user.findMany({
          // Só quem opera a empresa ativa pode ser vendedor do pedido.
          where: {
            deletedAt: null,
            role: { not: "CUSTOMER" },
            OR: [{ role: "MEDIATOR" }, { companies: { some: { companyId } } }],
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);
  const avail = await availabilityFor(companyId, products.map((p) => p.id));

  const formContacts: QuoteFormContact[] = contacts.map((c) => {
    const address = [c.street && `${c.street}${c.number ? `, ${c.number}` : ""}`, c.city && `${c.city}${c.state ? `/${c.state}` : ""}`, c.postalCode]
      .filter(Boolean)
      .join(" - ");
    return {
      id: c.id,
      label: c.accountName || `${c.firstName} ${c.lastName}`.trim(),
      person: `${c.firstName} ${c.lastName}`.trim(),
      cnpj: c.cnpj,
      ownerId: c.ownerId,
      billingAddress: address || null,
      shippingAddress: c.enderecoEntrega || address || null,
    };
  });
  const formProducts: QuoteFormProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    isKit: p._count.components > 0,
    price: p.price.toNumber(),
    minPrice: p.minPrice?.toNumber() ?? null,
    available: avail.get(p.id) ?? 0,
  }));
  const formSellers: QuoteFormSeller[] = sellers;
  return { contacts: formContacts, products: formProducts, sellers: formSellers, ownScope };
}
