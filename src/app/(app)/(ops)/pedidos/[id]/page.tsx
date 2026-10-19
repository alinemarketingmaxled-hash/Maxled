import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canApproveOrders, canEdit, canSeeCosts, canView } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { getOrderForSession, reachedStatus, CHANNEL_LABELS, ORDER_STATUS_LABELS } from "@/lib/erp/orders";
import { FISCAL_STATUS_LABELS } from "@/lib/erp/fiscal";
import { FIN_STATUS_LABELS } from "@/lib/erp/finance";
import { D } from "@/lib/erp/money";
import { fmtDate, fmtDateTime, fmtMoney, orderCode } from "@/lib/erp/format";
import { Badge, Card, NoCompany, PageHeader, Table, thCls, tdCls, btnPrimary, btnSecondary, btnDanger } from "@/components/erp/ui";
import { ActionButton } from "@/components/erp/ActionForm";
import { BackLink } from "@/components/shell/BackLink";
import { CustomerEmailsPanel } from "@/components/erp/CustomerEmailsPanel";
import { OrderStatusBadge } from "@/components/erp/pedidos/OrderStatusBadge";
import {
  submitOrderAction,
  approveOrderAction,
  rejectOrderAction,
  cancelOrderAction,
  emitInvoiceAction,
  duplicateOrderAction,
} from "../actions";

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("pedidos");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const { id } = await params;
  const order = await getOrderForSession(session, ctx.active.id, id);
  if (!order) notFound();

  const role = session.user.role;
  const editable = canEdit(role, "pedidos");
  const approver = canApproveOrders(role);
  const showCosts = canSeeCosts(role);
  const code = orderCode(order.company.code, order.number);
  const activeDoc = order.fiscalDocuments.find((d) => d.status !== "CANCELADA");
  const canEmit =
    canEdit(role, "fiscal") && order.status !== "CANCELADO" && reachedStatus(order.status, "APROVADO") && activeDoc?.status !== "AUTORIZADA";
  const canCancel =
    editable && order.status !== "CANCELADO" && !reachedStatus(order.status, "ENVIADO") && (!reachedStatus(order.status, "APROVADO") || approver);

  const costTotal = order.items.reduce((s, i) => s.add(i.unitCost.mul(i.quantity)), D(0));
  const margin = order.itemsTotal.sub(order.discountTotal).sub(costTotal);
  const marginPct = order.itemsTotal.greaterThan(0) ? margin.div(order.itemsTotal.sub(order.discountTotal)).mul(100) : D(0);
  const contactName = order.contact.accountName || `${order.contact.firstName} ${order.contact.lastName}`;
  const fields = { orderId: order.id };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <BackLink href="/pedidos" label="Pedidos" />
        <PageHeader
          title={`${order.status === "COTACAO" ? "Cotação" : "Pedido"} ${code}`}
          subtitle={
            <>
              {contactName} · vendedor {order.seller.name} · {CHANNEL_LABELS[order.channel]} · criado em {fmtDateTime(order.createdAt)}
            </>
          }
          actions={
            <>
              <OrderStatusBadge status={order.status} />
              <Link href={`/pedidos/${order.id}/proposta`} className={btnSecondary}>
                {order.proposalAcceptedAt ? "Proposta (aprovada pelo cliente)" : "Proposta / link de aprovação"}
              </Link>
              {editable && order.status === "COTACAO" && (
                <>
                  <Link href={`/pedidos/${order.id}/editar`} className={btnSecondary}>Editar</Link>
                  <ActionButton action={submitOrderAction} fields={fields} className={btnPrimary}>
                    Enviar pedido
                  </ActionButton>
                </>
              )}
              {approver && order.status === "AGUARDANDO_APROVACAO" && (
                <>
                  <ActionButton action={approveOrderAction} fields={fields} className={btnPrimary} confirm="Aprovar o pedido e reservar o estoque?">
                    Aprovar
                  </ActionButton>
                  <ActionButton action={rejectOrderAction} fields={fields} className={btnDanger} prompt="Motivo da reprovação:">
                    Reprovar
                  </ActionButton>
                </>
              )}
              {canEmit && (
                <ActionButton action={emitInvoiceAction} fields={fields} className={btnPrimary} confirm="Emitir a NF-e deste pedido?">
                  {activeDoc?.status === "REJEITADA" ? "Reenviar NF-e" : "Emitir NF-e"}
                </ActionButton>
              )}
              {canView(role, "expedicao") && reachedStatus(order.status, "APROVADO") && (
                <Link href={`/expedicao/${order.id}`} className={btnSecondary}>Expedição</Link>
              )}
              {editable && (
                <ActionButton action={duplicateOrderAction} fields={fields} className={btnSecondary}>
                  Duplicar como cotação
                </ActionButton>
              )}
              {canCancel && (
                <ActionButton action={cancelOrderAction} fields={fields} className={btnDanger} prompt="Motivo do cancelamento:">
                  Cancelar
                </ActionButton>
              )}
            </>
          }
        />
      </div>

      {order.rejectionReason && order.status === "COTACAO" && (
        <p className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
          Reprovado pela gerência: {order.rejectionReason}
        </p>
      )}
      {order.status === "CANCELADO" && (
        <p className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
          Cancelado em {fmtDateTime(order.cancelledAt)}: {order.cancelReason}
        </p>
      )}

      <Table
        head={
          <>
            <th className={thCls}>SKU</th>
            <th className={thCls}>Produto</th>
            <th className={`${thCls} text-right`}>Qtd</th>
            <th className={`${thCls} text-right`}>Preço unit.</th>
            <th className={`${thCls} text-right`}>Desc. %</th>
            <th className={`${thCls} text-right`}>Subtotal</th>
            {showCosts && <th className={`${thCls} text-right`}>Custo unit.</th>}
            {showCosts && <th className={`${thCls} text-right`}>Margem</th>}
          </>
        }
      >
        {order.items.map((i) => {
          const lineMargin = i.subtotal.sub(i.unitCost.mul(i.quantity));
          return (
            <tr key={i.id}>
              <td className={`${tdCls} font-semibold`}>{i.product.sku}</td>
              <td className={tdCls}>
                {i.product.name}
                {i.product._count.components > 0 && <span className="ml-1 text-[11px] text-gold">(kit)</span>}
                {i.belowMinPrice && <span className="ml-1"><Badge tone="warning">abaixo do mínimo</Badge></span>}
              </td>
              <td className={`${tdCls} text-right tabular-nums`}>{i.quantity} {i.product.unit}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(i.unitPrice)}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{i.discountPct.toString()}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(i.subtotal)}</td>
              {showCosts && <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(i.unitCost.toFixed(4))}</td>}
              {showCosts && (
                <td className={`${tdCls} text-right tabular-nums ${lineMargin.lessThan(0) ? "text-critical" : ""}`}>{fmtMoney(lineMargin)}</td>
              )}
            </tr>
          );
        })}
      </Table>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Totais">
          <dl className="grid grid-cols-2 gap-y-1 text-sm tabular-nums">
            <dt className="text-ink-muted">Itens</dt>
            <dd className="text-right">{fmtMoney(order.itemsTotal)}</dd>
            <dt className="text-ink-muted">Frete</dt>
            <dd className="text-right">{fmtMoney(order.freight)}</dd>
            <dt className="text-ink-muted">Outras despesas</dt>
            <dd className="text-right">{fmtMoney(order.otherExpenses)}</dd>
            <dt className="text-ink-muted">Desconto</dt>
            <dd className="text-right">- {fmtMoney(order.discountTotal)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-bold">{fmtMoney(order.total)}</dd>
            {showCosts && (
              <>
                <dt className="text-ink-muted">Margem bruta</dt>
                <dd className="text-right">{fmtMoney(margin)} ({marginPct.toFixed(1)}%)</dd>
              </>
            )}
          </dl>
          <p className="mt-2 text-[11px] text-ink-faint">Tributos calculados pelo provedor fiscal na emissão.</p>
        </Card>

        <Card title="Pagamento e entrega">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-ink-muted">Forma</dt>
            <dd>{order.paymentMethod || "-"}</dd>
            <dt className="text-ink-muted">Condição</dt>
            <dd>
              {order.installments}x · 1º em {order.firstDueDays}d{order.installments > 1 ? ` · a cada ${order.intervalDays}d` : ""}
            </dd>
            <dt className="text-ink-muted">Transportadora</dt>
            <dd>{order.carrier || "-"}</dd>
            <dt className="text-ink-muted">Modalidade</dt>
            <dd>{order.shippingMode || "-"}</dd>
            <dt className="text-ink-muted">Frete</dt>
            <dd>{order.freightPayer || "-"}</dd>
            <dt className="text-ink-muted">Validade</dt>
            <dd>{fmtDate(order.validUntil)}</dd>
          </dl>
          {order.shippingAddress && <p className="mt-2 text-xs text-ink-muted">Entrega: {order.shippingAddress}</p>}
          {order.billingAddress && <p className="mt-1 text-xs text-ink-muted">Faturamento: {order.billingAddress}</p>}
        </Card>

        <Card title="Aprovação comercial">
          {order.approvedAt ? (
            <p className="text-sm">
              {order.approvedBy ? (
                <>Aprovado por <strong>{order.approvedBy.name}</strong></>
              ) : (
                <>Aprovação automática</>
              )}{" "}
              em {fmtDateTime(order.approvedAt)}
            </p>
          ) : order.status === "AGUARDANDO_APROVACAO" ? (
            <p className="text-sm text-warning">Aguardando aprovação desde {fmtDateTime(order.submittedAt)}.</p>
          ) : (
            <p className="text-sm text-ink-muted">Ainda não enviado.</p>
          )}
          {order.approvalReason && <p className="mt-2 text-xs text-ink-muted">{order.approvalReason}</p>}
          {order.stockReservedAt && <p className="mt-2 text-xs text-good">Estoque reservado em {fmtDateTime(order.stockReservedAt)}.</p>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Documentos fiscais">
          {order.fiscalDocuments.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma nota emitida.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {order.fiscalDocuments.map((d) => (
                <li key={d.id} className="rounded-md border border-gold-deep/25 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {canView(role, "fiscal") ? (
                      <Link href={`/fiscal/${d.id}`} className="font-semibold text-gold hover:underline">
                        NF-e {d.number ?? "-"} série {d.series}
                      </Link>
                    ) : (
                      <span className="font-semibold">NF-e {d.number ?? "-"} série {d.series}</span>
                    )}
                    <Badge tone={d.status === "AUTORIZADA" ? "good" : d.status === "REJEITADA" ? "critical" : d.status === "CANCELADA" ? "neutral" : "info"}>
                      {FISCAL_STATUS_LABELS[d.status]}
                    </Badge>
                    {d.environment === "HOMOLOGACAO" && <Badge tone="warning">Homologação</Badge>}
                  </div>
                  {d.accessKey && <p className="mt-1 break-all font-mono text-[11px] text-ink-muted">{d.accessKey}</p>}
                  {d.status === "REJEITADA" && (
                    <p className="mt-1 text-xs text-critical">
                      Rejeição {d.rejectionCode}: {d.rejectionReason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Contas a receber">
          {order.receivables.length === 0 ? (
            <p className="text-sm text-ink-muted">Os títulos são gerados quando a NF-e é autorizada.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr>
                  <th className={thCls}>Parcela</th>
                  <th className={thCls}>Vencimento</th>
                  <th className={`${thCls} text-right`}>Valor</th>
                  <th className={`${thCls} text-right`}>Pago</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {order.receivables.map((r) => (
                  <tr key={r.id}>
                    <td className={tdCls}>{r.installment}/{r.installmentsTotal}</td>
                    <td className={tdCls}>{fmtDate(r.dueDate)}</td>
                    <td className={`${tdCls} text-right`}>{fmtMoney(r.amount)}</td>
                    <td className={`${tdCls} text-right`}>{fmtMoney(r.paidAmount)}</td>
                    <td className={tdCls}>
                      <Badge tone={r.status === "PAGO" ? "good" : r.status === "CANCELADO" ? "neutral" : r.dueDate < new Date() ? "critical" : "info"}>
                        {FIN_STATUS_LABELS[r.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canView(role, "financeiro") && order.receivables.length > 0 && (
            <Link href="/financeiro" className="mt-2 inline-block text-xs text-gold hover:underline">Abrir no Financeiro</Link>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Expedição">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-ink-muted">Separado em</dt>
            <dd>{fmtDateTime(order.separatedAt)}</dd>
            <dt className="text-ink-muted">Conferido em</dt>
            <dd>{fmtDateTime(order.checkedAt)}</dd>
            <dt className="text-ink-muted">Volumes / peso</dt>
            <dd>
              {order.packages ?? "-"} / {order.grossWeightKg ? `${order.grossWeightKg.toString()} kg` : "-"}
            </dd>
            <dt className="text-ink-muted">Enviado em</dt>
            <dd>{fmtDateTime(order.shippedAt)}</dd>
            <dt className="text-ink-muted">Rastreamento</dt>
            <dd className="break-all">{order.trackingCode || "-"}</dd>
            <dt className="text-ink-muted">Entregue em</dt>
            <dd>{fmtDateTime(order.deliveredAt)}</dd>
          </dl>
          {order.shippingIssue && (
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-warning/10 p-2 text-xs text-warning">{order.shippingIssue}</pre>
          )}
        </Card>

        <CustomerEmailsPanel session={session} contactId={order.contactId} orderId={order.id} />

        <Card title="Histórico">
          <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
            {order.events.map((e) => (
              <li key={e.id} className="border-l-2 border-gold-deep/40 pl-3">
                <p className="text-ink">{e.message}</p>
                <p className="text-[11px] text-ink-faint">
                  {fmtDateTime(e.createdAt)} · {e.userName ?? "Sistema"}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {(order.notes || order.internalNotes) && (
        <Card title="Observações">
          {order.notes && <p className="whitespace-pre-wrap text-sm">{order.notes}</p>}
          {order.internalNotes && (
            <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">Interno: {order.internalNotes}</p>
          )}
        </Card>
      )}
      <p className="text-[11px] text-ink-faint">Status: {ORDER_STATUS_LABELS[order.status]}</p>
    </div>
  );
}
