import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer, companyLabel } from "@/lib/erp/portal";
import { Card, EmptyState, Kpi, PageHeader } from "@/components/erp/ui";
import { fmtDate, fmtMoney, orderCode } from "@/lib/erp/format";
import { OrderStatusBadge, TitleStatusBadge } from "@/components/portal/badges";
import { D } from "@/lib/erp/money";

export default async function PortalHome() {
  const { contactId } = await requireCustomer();
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const [contact, orders, titles, schedules] = await Promise.all([
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
    prisma.receivable.findMany({
      where: { contactId, status: { in: ["ABERTO", "PARCIAL"] } },
      orderBy: { dueDate: "asc" },
      select: { id: true, description: true, amount: true, paidAmount: true, dueDate: true, status: true },
    }),
    prisma.customerSchedule.findMany({
      where: { contactId, active: true },
      orderBy: { nextDate: "asc" },
      take: 3,
      select: { id: true, title: true, nextDate: true },
    }),
  ]);

  const openTotal = titles.reduce((s, t) => s.add(t.amount.sub(t.paidAmount)), D(0));
  const overdue = titles.filter((t) => t.dueDate < today);
  const inProgress = orders.filter((o) => !["ENTREGUE", "CANCELADO", "COTACAO"].includes(o.status)).length;
  const address = [contact?.street, contact?.number, contact?.city, contact?.state, contact?.postalCode].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Olá, ${contact?.accountName || contact?.firstName || "cliente"}`} subtitle="Resumo da sua conta na MAX LED." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Pedidos em andamento" value={inProgress} hint="Entre os 5 mais recentes" />
        <Kpi label="Em aberto" value={fmtMoney(openTotal.toNumber())} hint={`${titles.length} parcela(s)`} />
        <Kpi label="Vencidos" value={overdue.length} tone={overdue.length > 0 ? "critical" : undefined} hint={overdue.length ? "Fale com o financeiro" : "Nenhuma pendência"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Pedidos recentes" actions={<Link href="/portal/pedidos" className="text-xs font-semibold text-gold hover:underline">Ver todos</Link>}>
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

        <Card title="Parcelas em aberto" actions={<Link href="/portal/financeiro" className="text-xs font-semibold text-gold hover:underline">Financeiro</Link>}>
          {titles.length === 0 ? (
            <EmptyState>Nenhuma parcela em aberto.</EmptyState>
          ) : (
            <ul className="divide-y divide-gold-deep/20">
              {titles.slice(0, 6).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-ink">
                    {t.description}
                    <span className="ml-2 text-xs text-ink-muted">vence {fmtDate(t.dueDate)}</span>
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {fmtMoney(t.amount.sub(t.paidAmount).toString())}
                    <TitleStatusBadge status={t.status} dueDate={t.dueDate} />
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
            <Info label="E-mail financeiro" value={contact?.emailFinanceiro} />
            <Info label="E-mail para NF-e" value={contact?.emailNfe} />
            <Info label="Endereço" value={address} />
            <Info label="Endereço de entrega" value={contact?.enderecoEntrega} />
          </dl>
        </Card>

        <Card title="Próximas programações" actions={<Link href="/portal/programacoes" className="text-xs font-semibold text-gold hover:underline">Ver todas</Link>}>
          {schedules.length === 0 ? (
            <EmptyState>Nenhuma programação ativa.</EmptyState>
          ) : (
            <ul className="divide-y divide-gold-deep/20">
              {schedules.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 py-2 text-sm">
                  <span className="text-ink">{s.title}</span>
                  <span className="text-ink-muted">{fmtDate(s.nextDate)}</span>
                </li>
              ))}
            </ul>
          )}
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
