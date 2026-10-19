import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCustomer, companyLabel, PORTAL_EVENT_LABELS } from "@/lib/erp/portal";
import { Card, EmptyState, PageHeader, Table, tdCls, thCls } from "@/components/erp/ui";
import { fmtDate, fmtDateTime, fmtMoney, orderCode } from "@/lib/erp/format";
import { OrderStatusBadge, TitleStatusBadge } from "@/components/portal/badges";

export default async function PortalOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { contactId } = await requireCustomer();
  const { id } = await params;

  // findFirst por id + contactId: pedido de outro cliente é 404, nunca 403
  // (não revela que o id existe).
  const order = await prisma.salesOrder.findFirst({
    where: { id, contactId },
    select: {
      id: true, number: true, status: true, createdAt: true, validUntil: true,
      itemsTotal: true, discountTotal: true, freight: true, otherExpenses: true, total: true,
      paymentMethod: true, installments: true, carrier: true, shippingMode: true, trackingCode: true,
      shippedAt: true, deliveredAt: true, packages: true, shippingAddress: true, billingAddress: true, notes: true,
      company: { select: { code: true, name: true, tradeName: true } },
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true, quantity: true, unitPrice: true, discountPct: true, subtotal: true,
          product: { select: { sku: true, name: true, unit: true } },
        },
      },
      events: {
        where: { type: { in: Object.keys(PORTAL_EVENT_LABELS) } },
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, createdAt: true },
      },
      fiscalDocuments: {
        where: { status: "AUTORIZADA" },
        select: { id: true, number: true, series: true, accessKey: true, authorizedAt: true, environment: true },
      },
      receivables: {
        where: { status: { not: "CANCELADO" } },
        orderBy: { installment: "asc" },
        select: { id: true, installment: true, installmentsTotal: true, amount: true, paidAmount: true, dueDate: true, status: true },
      },
    },
  });
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Pedido ${orderCode(order.company.code, order.number)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {companyLabel(order.company)} · {fmtDate(order.createdAt)} <OrderStatusBadge status={order.status} />
          </span>
        }
        actions={<Link href="/portal/pedidos" className="text-xs font-semibold text-gold hover:underline">Voltar aos pedidos</Link>}
      />

      <Table
        head={
          <>
            <th className={thCls}>SKU</th>
            <th className={thCls}>Produto</th>
            <th className={thCls}>Qtd.</th>
            <th className={thCls}>Preço unit.</th>
            <th className={thCls}>Desconto</th>
            <th className={thCls}>Subtotal</th>
          </>
        }
      >
        {order.items.map((i) => (
          <tr key={i.id}>
            <td className={tdCls}>{i.product.sku}</td>
            <td className={tdCls}>{i.product.name}</td>
            <td className={`${tdCls} tabular-nums`}>
              {i.quantity} {i.product.unit}
            </td>
            <td className={`${tdCls} tabular-nums`}>{fmtMoney(i.unitPrice.toString())}</td>
            <td className={`${tdCls} tabular-nums`}>{i.discountPct.greaterThan(0) ? `${i.discountPct.toString()}%` : "-"}</td>
            <td className={`${tdCls} tabular-nums`}>{fmtMoney(i.subtotal.toString())}</td>
          </tr>
        ))}
      </Table>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Totais">
          <dl className="flex flex-col gap-1 text-sm tabular-nums">
            <Row label="Itens" value={fmtMoney(order.itemsTotal.toString())} />
            {order.discountTotal.greaterThan(0) && <Row label="Desconto" value={`- ${fmtMoney(order.discountTotal.toString())}`} />}
            <Row label="Frete" value={fmtMoney(order.freight.toString())} />
            {order.otherExpenses.greaterThan(0) && <Row label="Outras despesas" value={fmtMoney(order.otherExpenses.toString())} />}
            <div className="mt-1 border-t border-gold-deep/30 pt-1">
              <Row label="Total" value={fmtMoney(order.total.toString())} strong />
            </div>
            <Row label="Pagamento" value={`${order.paymentMethod ?? "-"} · ${order.installments}x`} />
          </dl>
        </Card>

        <Card title="Entrega">
          <dl className="flex flex-col gap-1 text-sm">
            <Row label="Transportadora" value={order.carrier ?? "-"} />
            <Row label="Modalidade" value={order.shippingMode ?? "-"} />
            <Row label="Rastreio" value={order.trackingCode ?? "-"} />
            <Row label="Volumes" value={order.packages ? String(order.packages) : "-"} />
            <Row label="Enviado em" value={fmtDate(order.shippedAt)} />
            <Row label="Entregue em" value={fmtDate(order.deliveredAt)} />
          </dl>
          {order.shippingAddress && <p className="mt-2 whitespace-pre-line text-xs text-ink-muted">{order.shippingAddress}</p>}
        </Card>

        <Card title="Acompanhamento">
          {order.events.length === 0 ? (
            <p className="text-sm text-ink-muted">Sem atualizações ainda.</p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className="flex flex-col border-l-2 border-gold pl-3">
                  <span className="font-semibold text-ink">{PORTAL_EVENT_LABELS[e.type]}</span>
                  <span className="text-xs text-ink-muted">{fmtDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Notas fiscais">
          {order.fiscalDocuments.length === 0 ? (
            <EmptyState>Nenhuma nota fiscal emitida.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {order.fiscalDocuments.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    NF-e {d.number} série {d.series} · {fmtDate(d.authorizedAt)}
                    {d.environment === "HOMOLOGACAO" && <span className="ml-1 text-xs text-warning">(homologação, sem valor fiscal)</span>}
                    <span className="block break-all text-[11px] text-ink-faint">{d.accessKey}</span>
                  </span>
                  <a href={`/api/erp/fiscal/${d.id}/xml`} className="text-xs font-semibold text-gold hover:underline">
                    Baixar XML
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Pagamentos">
          {order.receivables.length === 0 ? (
            <EmptyState>As parcelas aparecem após a emissão da nota fiscal.</EmptyState>
          ) : (
            <ul className="divide-y divide-gold-deep/20 text-sm">
              {order.receivables.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    Parcela {r.installment}/{r.installmentsTotal} · vence {fmtDate(r.dueDate)}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {fmtMoney(r.amount.toString())}
                    <TitleStatusBadge status={r.status} dueDate={r.dueDate} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {order.notes && (
        <Card title="Observações">
          <p className="whitespace-pre-line text-sm text-ink">{order.notes}</p>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-bold text-ink" : ""}`}>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
