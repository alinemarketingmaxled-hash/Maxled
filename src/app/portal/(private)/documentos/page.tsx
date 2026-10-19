import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer, companyLabel } from "@/lib/erp/portal";
import { EmptyState, PageHeader, Table, tdCls, thCls } from "@/components/erp/ui";
import { fmtDate, fmtMoney, orderCode } from "@/lib/erp/format";

export default async function PortalDocuments() {
  const { contactId } = await requireCustomer();
  const docs = await prisma.fiscalDocument.findMany({
    where: { status: "AUTORIZADA", order: { contactId } },
    orderBy: { authorizedAt: "desc" },
    take: 200,
    select: {
      id: true, number: true, series: true, accessKey: true, authorizedAt: true, totalAmount: true, environment: true,
      order: { select: { id: true, number: true } },
      company: { select: { code: true, name: true, tradeName: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Documentos fiscais" subtitle="Notas fiscais autorizadas dos seus pedidos." />
      {docs.length === 0 ? (
        <EmptyState>Nenhuma nota fiscal autorizada.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>NF-e</th>
              <th className={thCls}>Emitente</th>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Autorização</th>
              <th className={thCls}>Valor</th>
              <th className={thCls}>Chave de acesso</th>
              <th className={thCls}>XML</th>
            </>
          }
        >
          {docs.map((d) => (
            <tr key={d.id}>
              <td className={tdCls}>
                {d.number} / {d.series}
                {d.environment === "HOMOLOGACAO" && <span className="block text-[11px] text-warning">Homologação</span>}
              </td>
              <td className={tdCls}>{companyLabel(d.company)}</td>
              <td className={tdCls}>
                <Link href={`/portal/pedidos/${d.order.id}`} className="text-gold hover:underline">
                  {orderCode(d.company.code, d.order.number)}
                </Link>
              </td>
              <td className={tdCls}>{fmtDate(d.authorizedAt)}</td>
              <td className={`${tdCls} tabular-nums`}>{fmtMoney(d.totalAmount.toString())}</td>
              <td className={`${tdCls} break-all text-[11px] text-ink-muted`}>{d.accessKey}</td>
              <td className={tdCls}>
                <a href={`/api/erp/fiscal/${d.id}/xml`} className="text-xs font-semibold text-gold hover:underline">
                  Baixar
                </a>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
