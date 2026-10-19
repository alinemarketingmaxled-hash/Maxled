import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer, companyLabel } from "@/lib/erp/portal";
import { Card, EmptyState, Kpi, PageHeader } from "@/components/erp/ui";
import { fmtDate, fmtMoney, orderCode } from "@/lib/erp/format";
import { OrderStatusBadge } from "@/components/portal/badges";

export default async function PortalHome() {
  const { contactId } = await requireCustomer();

  // O portal mostra só cotações e pedidos: nada de financeiro, documentos
  // ou programações.
  const [contact, orders, quotes, inProgress] = await Promise.all([
    prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        firstName: true, lastName: true, accountName: true, cnpj: true, inscricaoEstadual: true,
        email: true, emailFinanceiro: true, emailNfe: true, phone: true, mobile: true,
        street: true, number: true, city: true, state: true, postalCode: true, enderecoEntrega: true,
      },
    }),
    prisma.salesOrder.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, number: true, status: true, total: true, createdAt: true,
        company: { select: { code: true, name: true, tradeName: true } },
      },
    }),
    prisma.salesOrder.count({ where: { contactId, status: "COTACAO" } }),
    prisma.salesOrder.count({ where: { contactId, status: { notIn: ["COTACAO", "ENTREGUE", "CANCELADO"] } } }),
  ]);

  const address = [contact?.street, contact?.number, contact?.city, contact?.state, contact?.postalCode].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Olá, ${contact?.accountName || contact?.firstName || "cliente"}`} subtitle="Resumo da sua conta na MAX LED." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Kpi label="Cotações abertas" value={quotes} hint="Aguardando sua aprovação" />
        <Kpi label="Pedidos em andamento" value={inProgress} hint="Da aprovação até a entrega" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cotações e pedidos recentes" actions={<Link href="/portal/pedidos" className="text-xs font-semibold text-gold hover:underline">Ver todos</Link>}>
          {orders.length === 0 ? (
            <EmptyState>Nenhum pedido ainda.</EmptyState>
          ) : (
            <ul className="divide-y divide-gold-deep/20">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/portal/pedidos/${o.id}`} className="text-sm font-semibold text-ink hover:text-gold">
                    {orderCode(o.company.code, o.number)}
                    <span className="ml-2 text-xs font-normal text-ink-muted">{companyLabel(o.company)} · {fmtDate(o.createdAt)}</span>
                  </Link>
                  <span className="flex items-center gap-2 text-sm tabular-nums">
                    {fmtMoney(o.total.toString())}
                    <OrderStatusBadge status={o.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Seu cadastro" actions={<Link href="/portal/solicitacoes" className="text-xs font-semibold text-gold hover:underline">Solicitar atualização</Link>}>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <Info label="Razão social / nome" value={contact?.accountName || `${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`} />
            <Info label="CPF/CNPJ" value={contact?.cnpj} />
            <Info label="Inscrição estadual" value={contact?.inscricaoEstadual} />
            <Info label="Telefone" value={contact?.phone || contact?.mobile} />
            <Info label="E-mail comercial" value={contact?.email} />
                        <Info label="E-mail para NF-e" value={contact?.emailNfe} />
            <Info label="Endereço" value={address} />
            <Info label="Endereço de entrega" value={contact?.enderecoEntrega} />
          </dl>
        </Card>

      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-ink">{value?.trim() || "-"}</dd>
    </div>
  );
}
