import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtMoney, orderCode } from "@/lib/erp/format";
import { EmptyState, Kpi, Table, tdCls, thCls } from "@/components/erp/ui";

/** Faturamento = notas autorizadas no mês (fato fiscal). Não confundir com
 * contas a receber (títulos) nem com liquidação (dinheiro que entrou). */
export async function BillingTab({ companyId, companyCode }: { companyId: string; companyCode: string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const docs = await prisma.fiscalDocument.findMany({
    where: { companyId, status: "AUTORIZADA", authorizedAt: { gte: monthStart } },
    orderBy: { authorizedAt: "desc" },
    include: { order: { select: { id: true, number: true, contact: { select: { firstName: true, lastName: true, accountName: true } } } } },
  });
  const total = docs.reduce((s, d) => s + d.totalAmount.toNumber(), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Faturado no mês" value={fmtMoney(total)} hint="notas fiscais autorizadas" />
        <Kpi label="Notas no mês" value={docs.length} />
        <Kpi label="Ticket médio" value={fmtMoney(docs.length ? total / docs.length : 0)} />
      </div>
      {docs.length === 0 ? (
        <EmptyState>Nenhuma nota autorizada neste mês.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Data</th>
              <th className={thCls}>NF-e</th>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Cliente</th>
              <th className={`${thCls} text-right`}>Valor</th>
            </>
          }
        >
          {docs.map((d) => (
            <tr key={d.id}>
              <td className={tdCls}>{fmtDate(d.authorizedAt)}</td>
              <td className={tdCls}>
                <Link href={`/fiscal/${d.id}`} className="text-gold hover:underline">
                  {d.number}/{d.series}
                </Link>
              </td>
              <td className={tdCls}>
                <Link href={`/pedidos/${d.order.id}`} className="hover:underline">
                  {orderCode(companyCode, d.order.number)}
                </Link>
              </td>
              <td className={tdCls}>{d.order.contact.accountName || `${d.order.contact.firstName} ${d.order.contact.lastName}`}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(d.totalAmount)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
