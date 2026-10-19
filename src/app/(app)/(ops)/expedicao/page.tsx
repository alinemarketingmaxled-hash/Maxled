import Link from "next/link";
import type { SalesOrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { D } from "@/lib/erp/money";
import { fmtDate, orderCode } from "@/lib/erp/format";
import { Badge, EmptyState, NoCompany, PageHeader, Table, Tabs, thCls, tdCls } from "@/components/erp/ui";

const QUEUES: { key: string; label: string; status: SalesOrderStatus }[] = [
  { key: "separar", label: "Aprovados para separar", status: "APROVADO" },
  { key: "separacao", label: "Em separação", status: "EM_SEPARACAO" },
  { key: "conferencia", label: "Em conferência", status: "EM_CONFERENCIA" },
  { key: "expedir", label: "Prontos para expedir", status: "PRONTO_EXPEDICAO" },
  { key: "enviados", label: "Enviados (aguardando entrega)", status: "ENVIADO" },
];

function ageLabel(from: Date) {
  const hours = Math.floor((Date.now() - from.getTime()) / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function ExpedicaoPage({ searchParams }: { searchParams: Promise<{ fila?: string }> }) {
  const session = await requireView("expedicao");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const { fila } = await searchParams;
  const queue = QUEUES.find((q) => q.key === fila) ?? QUEUES[0];
  const companyId = ctx.active.id;

  const [counts, orders] = await Promise.all([
    prisma.salesOrder.groupBy({
      by: ["status"],
      where: { companyId, status: { in: QUEUES.map((q) => q.status) } },
      _count: { _all: true },
    }),
    prisma.salesOrder.findMany({
      where: { companyId, status: queue.status },
      // Fila por ordem de chegada: quem foi aprovado primeiro sai primeiro.
      orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
      take: 300,
      select: {
        id: true, number: true, approvedAt: true, createdAt: true, shippedAt: true, carrier: true, trackingCode: true,
        shippingIssue: true, packages: true,
        contact: { select: { firstName: true, lastName: true, accountName: true, city: true, state: true } },
        items: { select: { quantity: true, product: { select: { weightKg: true } } } },
        fiscalDocuments: { where: { activeKey: { not: null } }, select: { status: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Expedição" subtitle={`${ctx.active.code} · separação, conferência, embalagem e despacho`} />
      <Tabs
        active={queue.key}
        tabs={QUEUES.map((q) => ({
          key: q.key,
          label: q.label,
          href: `/expedicao?fila=${q.key}`,
          count: counts.find((c) => c.status === q.status)?._count._all ?? 0,
        }))}
      />
      {orders.length === 0 ? (
        <EmptyState>Nenhum pedido nesta etapa.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Cliente</th>
              <th className={`${thCls} text-right`}>Itens</th>
              <th className={`${thCls} text-right`}>Peso est.</th>
              <th className={thCls}>NF-e</th>
              <th className={thCls}>{queue.status === "ENVIADO" ? "Envio" : "Na fila há"}</th>
            </>
          }
        >
          {orders.map((o) => {
            let weight = D(0);
            let missingWeight = false;
            for (const i of o.items) {
              if (i.product.weightKg) weight = weight.add(i.product.weightKg.mul(i.quantity));
              else missingWeight = true;
            }
            const nfOk = o.fiscalDocuments.some((d) => d.status === "AUTORIZADA");
            const since = o.approvedAt ?? o.createdAt;
            return (
              <tr key={o.id} className="hover:bg-surface-2">
                <td className={tdCls}>
                  <Link href={`/expedicao/${o.id}`} className="font-semibold text-gold hover:underline">
                    {orderCode(ctx.active.code, o.number)}
                  </Link>
                  {o.shippingIssue && <span className="ml-1"><Badge tone="warning">ocorrência</Badge></span>}
                </td>
                <td className={tdCls}>
                  {o.contact.accountName || `${o.contact.firstName} ${o.contact.lastName}`}
                  {o.contact.city && <span className="block text-[11px] text-ink-faint">{o.contact.city}/{o.contact.state}</span>}
                </td>
                <td className={`${tdCls} text-right tabular-nums`}>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                <td className={`${tdCls} text-right tabular-nums`}>
                  {weight.greaterThan(0) ? `${weight.toFixed(2)} kg${missingWeight ? "+" : ""}` : "-"}
                </td>
                <td className={tdCls}>
                  {nfOk ? <Badge tone="good">Autorizada</Badge> : <Badge tone={queue.status === "PRONTO_EXPEDICAO" ? "critical" : "neutral"}>Pendente</Badge>}
                </td>
                <td className={`${tdCls} tabular-nums`}>
                  {queue.status === "ENVIADO" ? (
                    <>
                      {fmtDate(o.shippedAt)} {o.carrier && <span className="block text-[11px] text-ink-faint">{o.carrier} {o.trackingCode}</span>}
                    </>
                  ) : (
                    ageLabel(since)
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
      {queue.status === "PRONTO_EXPEDICAO" && (
        <p className="mt-2 text-xs text-ink-faint">O despacho só é liberado com a NF-e autorizada.</p>
      )}
    </div>
  );
}
