import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { reachedStatus } from "@/lib/erp/orders";
import { FIN_STATUS_LABELS } from "@/lib/erp/finance";
import { fmtDateTime, fmtMoney, orderCode } from "@/lib/erp/format";
import { ActionButton } from "@/components/erp/ActionForm";
import { FiscalStatusBadge, formatAccessKey } from "@/components/erp/fiscal/FiscalStatusBadge";
import { Card, NoCompany, PageHeader, Table, btnDanger, btnPrimary, btnSecondary, tdCls, thCls } from "@/components/erp/ui";
import { cancelAction, emitAction } from "../actions";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink-faint">{label}</dt>
      <dd className="break-words text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

export default async function FiscalDocPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("fiscal");
  const { id } = await params;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const doc = await prisma.fiscalDocument.findFirst({
    where: { id, companyId: ctx.active.id },
    include: {
      company: { select: { code: true } },
      order: {
        include: {
          contact: { select: { firstName: true, lastName: true, accountName: true, cnpj: true } },
          items: { orderBy: { position: "asc" }, include: { product: { select: { sku: true, name: true, ncm: true } } } },
        },
      },
      receivables: { orderBy: { installment: "asc" } },
    },
  });
  if (!doc) notFound();

  const editable = canEdit(session.user.role, "fiscal");
  const homolog = doc.environment === "HOMOLOGACAO";
  const c = doc.order.contact;
  const canCancel = editable && doc.status === "AUTORIZADA" && !reachedStatus(doc.order.status, "ENVIADO");
  const canResend = editable && doc.status === "REJEITADA" && doc.activeKey !== null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`NF-e ${doc.number ?? "-"} / série ${doc.series}`}
        subtitle={
          <>
            Pedido{" "}
            <Link href={`/pedidos/${doc.orderId}`} className="text-gold underline">
              {orderCode(doc.company.code, doc.order.number)}
            </Link>{" "}
            · {c.accountName || `${c.firstName} ${c.lastName}`}
          </>
        }
        actions={
          <>
            <Link href="/fiscal" className={btnSecondary}>
              Voltar
            </Link>
            {doc.status === "AUTORIZADA" && (
              <>
                <a href={`/api/erp/fiscal/${doc.id}/xml`} className={btnSecondary}>
                  Baixar XML
                </a>
                <Link href={`/fiscal/${doc.id}/danfe`} className={btnSecondary}>
                  Ver DANFE
                </Link>
              </>
            )}
            {canResend && (
              <ActionButton action={emitAction} fields={{ orderId: doc.orderId }} className={btnPrimary}>
                Reenviar
              </ActionButton>
            )}
            {canCancel && (
              <ActionButton
                action={cancelAction}
                fields={{ docId: doc.id }}
                className={btnDanger}
                prompt="Justificativa do cancelamento (mínimo 15 caracteres):"
              >
                Cancelar nota
              </ActionButton>
            )}
          </>
        }
      />

      {homolog && (
        <div role="note" className="rounded-xl border-2 border-warning/60 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
          HOMOLOGAÇÃO: documento emitido em ambiente de testes, SEM VALOR FISCAL.
        </div>
      )}

      <Card title="Dados da nota">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Info label="Status">
            <FiscalStatusBadge status={doc.status} />
          </Info>
          <Info label="Ambiente">{homolog ? "Homologação" : "Produção"}</Info>
          <Info label="Provedor">{doc.provider === "simulador" ? "Simulador" : doc.provider}</Info>
          <Info label="Tentativas">{doc.attempts}</Info>
          <Info label="Valor total">{fmtMoney(doc.totalAmount)}</Info>
          <Info label="Criada em">{fmtDateTime(doc.createdAt)}</Info>
          <Info label="Autorizada em">{fmtDateTime(doc.authorizedAt)}</Info>
          <Info label="Protocolo">{doc.protocol ?? "-"}</Info>
          <div className="col-span-2 md:col-span-4">
            <Info label="Chave de acesso">
              <span className="font-mono tabular-nums">{formatAccessKey(doc.accessKey)}</span>
            </Info>
          </div>
        </dl>
      </Card>

      {doc.rejectionReason && (
        <Card title="Rejeição">
          <p className="text-sm text-critical">
            Código {doc.rejectionCode}: {doc.rejectionReason}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Corrija o cadastro e reenvie: a mesma nota é reaproveitada, sem gerar numeração nova.{" "}
            <Link href={`/vendas?id=${doc.order.contactId}&edit=1`} className="text-gold underline">
              Cadastro do cliente
            </Link>
          </p>
        </Card>
      )}

      {doc.status === "CANCELADA" && (
        <Card title="Cancelamento">
          <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Info label="Cancelada em">{fmtDateTime(doc.cancelledAt)}</Info>
            <Info label="Protocolo do evento">{doc.cancelProtocol ?? "-"}</Info>
            <Info label="Justificativa">{doc.cancelReason ?? "-"}</Info>
          </dl>
        </Card>
      )}

      <Card title="Itens">
        <Table
          head={
            <>
              <th className={thCls}>SKU</th>
              <th className={thCls}>Produto</th>
              <th className={thCls}>NCM</th>
              <th className={`${thCls} text-right`}>Qtd.</th>
              <th className={`${thCls} text-right`}>Unitário</th>
              <th className={`${thCls} text-right`}>Subtotal</th>
            </>
          }
        >
          {doc.order.items.map((i) => (
            <tr key={i.id}>
              <td className={tdCls}>{i.product.sku}</td>
              <td className={tdCls}>{i.product.name}</td>
              <td className={`${tdCls} ${i.product.ncm ? "" : "text-critical"}`}>{i.product.ncm ?? "ausente"}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{i.quantity}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(i.unitPrice)}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(i.subtotal)}</td>
            </tr>
          ))}
        </Table>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Info label="Produtos">{fmtMoney(doc.order.itemsTotal)}</Info>
          <Info label="Frete">{fmtMoney(doc.order.freight)}</Info>
          <Info label="Desconto">{fmtMoney(doc.order.discountTotal)}</Info>
          <Info label="Total da nota">{fmtMoney(doc.order.total)}</Info>
        </dl>
      </Card>

      {doc.receivables.length > 0 && (
        <Card title="Contas a receber geradas">
          <ul className="flex flex-col gap-1 text-sm">
            {doc.receivables.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2">
                <span>{r.description}</span>
                <span className="tabular-nums">
                  {fmtMoney(r.amount)} · {FIN_STATUS_LABELS[r.status]}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/financeiro?aba=receber" className="mt-2 inline-block text-xs text-gold underline">
            Abrir no Financeiro
          </Link>
        </Card>
      )}
    </div>
  );
}
