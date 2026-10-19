import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer, companyLabel } from "@/lib/erp/portal";
import { EmptyState, PageHeader, Table, tdCls, thCls } from "@/components/erp/ui";
import { fmtDate, fmtMoney, orderCode } from "@/lib/erp/format";
import { OrderStatusBadge } from "@/components/portal/badges";

export default async function PortalOrders() {
  const { contactId } = await requireCustomer();
  const orders = await prisma.salesOrder.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, number: true, status: true, total: true, createdAt: true, trackingCode: true, carrier: true,
      company: { select: { code: true, name: true, tradeName: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Pedidos" subtitle="Cotações e pedidos da sua empresa, com status e entrega." />
      {orders.length === 0 ? (
        <EmptyState>Nenhum pedido encontrado.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Empresa</th>
              <th className={thCls}>Data</th>
              <th className={thCls}>Itens</th>
              <th className={thCls}>Total</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Rastreio</th>
            </>
          }
        >
          {orders.map((o) => (
            <tr key={o.id}>
              <td className={tdCls}>
                <Link href={`/portal/pedidos/${o.id}`} className="font-semibold text-gold hover:underline">
                  {orderCode(o.company.code, o.number)}
                </Link>
              </td>
              <td className={tdCls}>{companyLabel(o.company)}</td>
              <td className={tdCls}>{fmtDate(o.createdAt)}</td>
              <td className={`${tdCls} tabular-nums`}>{o._count.items}</td>
              <td className={`${tdCls} tabular-nums`}>{fmtMoney(o.total.toString())}</td>
              <td className={tdCls}>
                <OrderStatusBadge status={o.status} />
              </td>
              <td className={tdCls}>{o.trackingCode ? `${o.carrier ?? ""} ${o.trackingCode}` : "-"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
