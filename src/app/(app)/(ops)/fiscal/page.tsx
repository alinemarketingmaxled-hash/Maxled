import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { ORDER_STATUS_LABELS } from "@/lib/erp/orders";
import { fmtDate, fmtDateTime, fmtMoney, orderCode } from "@/lib/erp/format";
import { ActionButton } from "@/components/erp/ActionForm";
import { FiscalStatusBadge } from "@/components/erp/fiscal/FiscalStatusBadge";
import {
  Badge, Card, EmptyState, Field, Kpi, NoCompany, PageHeader, Table, Tabs,
  btnPrimary, btnSecondary, inputCls, tdCls, thCls,
} from "@/components/erp/ui";
import { emitAction } from "./actions";

type Tab = "pendentes" | "rejeitadas" | "autorizadas" | "canceladas" | "todas";
const TABS: { key: Tab; label: string }[] = [
  { key: "pendentes", label: "Pendentes de emissão" },
  { key: "rejeitadas", label: "Rejeitadas" },
  { key: "autorizadas", label: "Autorizadas" },
  { key: "canceladas", label: "Canceladas" },
  { key: "todas", label: "Todas" },
];

function dayStart(v?: string) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00-03:00`) : undefined;
}
function dayEnd(v?: string) {
  const d = dayStart(v);
  return d ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : undefined;
}

export default async function FiscalPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; de?: string; ate?: string; numero?: string }>;
}) {
  const session = await requireView("fiscal");
  const params = await searchParams;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const companyId = ctx.active.id;
  const editable = canEdit(session.user.role, "fiscal");
  const tab: Tab = TABS.some((t) => t.key === params.aba) ? (params.aba as Tab) : "pendentes";

  const from = dayStart(params.de);
  const to = dayEnd(params.ate);
  const numero = params.numero && /^\d+$/.test(params.numero) ? Number(params.numero) : undefined;
  const period = from || to ? { gte: from, lt: to } : undefined;

  const pendingWhere: Prisma.SalesOrderWhereInput = {
    companyId,
    status: { in: ["APROVADO", "EM_SEPARACAO", "EM_CONFERENCIA", "PRONTO_EXPEDICAO"] },
    fiscalDocuments: { none: { status: "AUTORIZADA" } },
    ...(period ? { approvedAt: period } : {}),
    ...(numero ? { number: numero } : {}),
  };
  const docBase: Prisma.FiscalDocumentWhereInput = {
    companyId,
    ...(period ? { createdAt: period } : {}),
    ...(numero ? { number: numero } : {}),
  };
  const docWhere: Record<Exclude<Tab, "pendentes">, Prisma.FiscalDocumentWhereInput> = {
    // Só a rejeição "atual" de cada pedido (ainda vinculada a ele).
    rejeitadas: { ...docBase, status: "REJEITADA", activeKey: { not: null } },
    autorizadas: { ...docBase, status: "AUTORIZADA" },
    canceladas: { ...docBase, status: "CANCELADA" },
    todas: docBase,
  };

  const [company, counts, pending, docs] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { code: true, fiscalEnvironment: true, fiscalProvider: true, fiscalSeries: true, nextFiscalNumber: true },
    }),
    Promise.all([
      prisma.salesOrder.count({ where: pendingWhere }),
      prisma.fiscalDocument.count({ where: docWhere.rejeitadas }),
      prisma.fiscalDocument.count({ where: docWhere.autorizadas }),
      prisma.fiscalDocument.count({ where: docWhere.canceladas }),
      prisma.fiscalDocument.count({ where: docWhere.todas }),
    ]),
    tab === "pendentes"
      ? prisma.salesOrder.findMany({
          where: pendingWhere,
          orderBy: { approvedAt: "asc" },
          take: 200,
          include: {
            contact: { select: { firstName: true, lastName: true, accountName: true } },
            fiscalDocuments: { where: { activeKey: { not: null } }, select: { status: true, rejectionCode: true, rejectionReason: true } },
          },
        })
      : Promise.resolve([]),
    tab !== "pendentes"
      ? prisma.fiscalDocument.findMany({
          where: docWhere[tab],
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            order: {
              select: {
                id: true, number: true, contactId: true,
                contact: { select: { firstName: true, lastName: true, accountName: true } },
                items: { select: { product: { select: { id: true, sku: true } } } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const countByTab: Record<Tab, number> = {
    pendentes: counts[0], rejeitadas: counts[1], autorizadas: counts[2], canceladas: counts[3], todas: counts[4],
  };
  const qs = (aba: string) => {
    const p = new URLSearchParams();
    p.set("aba", aba);
    if (params.de) p.set("de", params.de);
    if (params.ate) p.set("ate", params.ate);
    if (params.numero) p.set("numero", params.numero);
    return `/fiscal?${p.toString()}`;
  };
  const contactName = (c: { firstName: string; lastName: string; accountName: string | null }) =>
    c.accountName || `${c.firstName} ${c.lastName}`;
  const homolog = company.fiscalEnvironment === "HOMOLOGACAO";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Fiscal"
        subtitle={`Documentos fiscais da empresa ${ctx.active.code} · ${ctx.active.tradeName || ctx.active.name}`}
        actions={homolog ? <Badge tone="warning">Ambiente de HOMOLOGAÇÃO: notas sem valor fiscal</Badge> : <Badge tone="good">Produção</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pendentes de emissão" value={countByTab.pendentes} tone={countByTab.pendentes ? "warning" : undefined} />
        <Kpi label="Rejeitadas" value={countByTab.rejeitadas} tone={countByTab.rejeitadas ? "critical" : undefined} />
        <Kpi label="Autorizadas" value={countByTab.autorizadas} />
        <Kpi label="Canceladas" value={countByTab.canceladas} />
      </div>

      <Card title="Configuração fiscal">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-ink-faint">Ambiente</dt>
            <dd className="font-semibold">{homolog ? "Homologação" : "Produção"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-faint">Provedor</dt>
            <dd className="font-semibold">{company.fiscalProvider === "simulador" ? "Simulador de homologação" : company.fiscalProvider}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-faint">Série</dt>
            <dd className="font-semibold tabular-nums">{company.fiscalSeries}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-faint">Próximo número</dt>
            <dd className="font-semibold tabular-nums">{company.nextFiscalNumber}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-muted">
          A emissão em produção depende da integração com o provedor fiscal atual e do certificado digital da empresa
          (Documento Mestre §12). Nesta versão o certificado nunca é enviado pelo navegador: ele será configurado no
          servidor, junto com as credenciais do provedor. Tributos são calculados pelo provedor fiscal, não por percentuais fixos.
        </p>
      </Card>

      <form className="flex flex-wrap items-end gap-2" action="/fiscal">
        <input type="hidden" name="aba" value={tab} />
        <Field label="De">
          <input type="date" name="de" defaultValue={params.de} className={inputCls} />
        </Field>
        <Field label="Até">
          <input type="date" name="ate" defaultValue={params.ate} className={inputCls} />
        </Field>
        <Field label={tab === "pendentes" ? "Nº do pedido" : "Nº da nota"}>
          <input type="text" inputMode="numeric" name="numero" defaultValue={params.numero} className={`${inputCls} w-32`} />
        </Field>
        <button className={btnSecondary}>Filtrar</button>
        {(params.de || params.ate || params.numero) && (
          <Link href={`/fiscal?aba=${tab}`} className="text-xs text-ink-muted underline">
            Limpar
          </Link>
        )}
      </form>

      <Tabs tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: qs(t.key), count: countByTab[t.key] }))} active={tab} />

      {tab === "pendentes" ? (
        pending.length === 0 ? (
          <EmptyState>Nenhum pedido aprovado aguardando nota fiscal.</EmptyState>
        ) : (
          <Table
            head={
              <>
                <th className={thCls}>Pedido</th>
                <th className={thCls}>Cliente</th>
                <th className={thCls}>Status do pedido</th>
                <th className={thCls}>Aprovado em</th>
                <th className={`${thCls} text-right`}>Total</th>
                <th className={thCls}>Situação fiscal</th>
                <th className={thCls}></th>
              </>
            }
          >
            {pending.map((o) => {
              const current = o.fiscalDocuments[0];
              return (
                <tr key={o.id}>
                  <td className={tdCls}>
                    <Link href={`/pedidos/${o.id}`} className="font-semibold text-gold hover:underline">
                      {orderCode(company.code, o.number)}
                    </Link>
                  </td>
                  <td className={tdCls}>{contactName(o.contact)}</td>
                  <td className={tdCls}>{ORDER_STATUS_LABELS[o.status]}</td>
                  <td className={tdCls}>{fmtDate(o.approvedAt)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(o.total)}</td>
                  <td className={tdCls}>
                    {current ? (
                      <span className="flex flex-col gap-1">
                        <FiscalStatusBadge status={current.status} />
                        {current.rejectionReason && (
                          <span className="text-[11px] text-critical">
                            {current.rejectionCode}: {current.rejectionReason}
                          </span>
                        )}
                      </span>
                    ) : (
                      <Badge>Sem nota</Badge>
                    )}
                  </td>
                  <td className={tdCls}>
                    {editable && (
                      <ActionButton action={emitAction} fields={{ orderId: o.id }} className={btnPrimary}>
                        {current ? "Reenviar" : "Emitir NF-e"}
                      </ActionButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )
      ) : docs.length === 0 ? (
        <EmptyState>Nenhuma nota nesta situação.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Nota</th>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Cliente</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Data</th>
              <th className={`${thCls} text-right`}>Valor</th>
              {tab === "rejeitadas" && <th className={thCls}>Motivo e correção</th>}
              <th className={thCls}></th>
            </>
          }
        >
          {docs.map((d) => (
            <tr key={d.id}>
              <td className={tdCls}>
                <Link href={`/fiscal/${d.id}`} className="font-semibold text-gold hover:underline">
                  {d.number ?? "-"}/{d.series}
                </Link>
                {d.environment === "HOMOLOGACAO" && <span className="ml-1.5 text-[10px] text-warning">HOMOLOG.</span>}
              </td>
              <td className={tdCls}>
                <Link href={`/pedidos/${d.order.id}`} className="hover:underline">
                  {orderCode(company.code, d.order.number)}
                </Link>
              </td>
              <td className={tdCls}>{contactName(d.order.contact)}</td>
              <td className={tdCls}>
                <FiscalStatusBadge status={d.status} />
              </td>
              <td className={tdCls}>{fmtDateTime(d.authorizedAt ?? d.createdAt)}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(d.totalAmount)}</td>
              {tab === "rejeitadas" && (
                <td className={`${tdCls} max-w-sm`}>
                  <p className="text-[12px] text-critical">
                    {d.rejectionCode}: {d.rejectionReason}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
                    <Link href={`/vendas?id=${d.order.contactId}&edit=1`} className="text-gold underline">
                      Corrigir cliente
                    </Link>
                    {d.order.items.map((i) => (
                      <Link key={i.product.id} href={`/produtos/${i.product.id}`} className="text-gold underline">
                        {i.product.sku}
                      </Link>
                    ))}
                  </p>
                </td>
              )}
              <td className={tdCls}>
                <span className="flex flex-wrap gap-2">
                  {tab === "rejeitadas" && editable && (
                    <ActionButton action={emitAction} fields={{ orderId: d.order.id }} className={btnPrimary}>
                      Reenviar
                    </ActionButton>
                  )}
                  <Link href={`/fiscal/${d.id}`} className={btnSecondary}>
                    Detalhes
                  </Link>
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
