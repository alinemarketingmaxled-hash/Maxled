import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit, canSeeCosts, canView } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/erp/format";
import { FIN_STATUS_LABELS } from "@/lib/erp/finance";
import {
  ALLOCATION_LABELS,
  PURCHASE_STATUS_LABELS,
  canApprovePurchases,
  canReceivePurchases,
  computeLandedCosts,
  purchaseTotal,
} from "@/lib/erp/purchasing";
import { PageHeader, Card, Table, thCls, tdCls, Badge, NoCompany, EmptyState, btnPrimary, btnSecondary, btnDanger, inputCls, Field } from "@/components/erp/ui";
import { ActionForm, ActionButton } from "@/components/erp/ActionForm";
import { PURCHASE_STATUS_TONE } from "@/components/erp/compras/status";
import { approvePurchaseAction, cancelPurchaseAction, quotePurchaseAction, receivePurchaseAction } from "../actions";

type ReceiptItem = { itemId: string; sku: string; quantity: number; landedUnitCost: string };

export default async function CompraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("compras");
  let companyId: string;
  try {
    companyId = (await getCompanyContext(session)).active.id;
  } catch {
    return <NoCompany />;
  }
  const { id } = await params;
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, weightKg: true } } } },
      receipts: { orderBy: { createdAt: "desc" } },
      payables: { orderBy: { installment: "asc" } },
    },
  });
  if (!po) notFound();

  const userIds = [po.requestedById, po.approvedById, ...po.receipts.map((r) => r.userId)].filter((x): x is string => !!x);
  const users = new Map(
    (await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );

  const role = session.user.role;
  const costs = canSeeCosts(role);
  const editable = canEdit(role, "compras");
  const landed = computeLandedCosts(po);
  const totals = purchaseTotal(po);
  const pending = po.status === "SOLICITADO" || po.status === "COTACAO";
  const receivable = (po.status === "APROVADO" || po.status === "RECEBIDO_PARCIAL") && canReceivePurchases(role);
  const cancellable = po.status !== "CANCELADO" && po.status !== "RECEBIDO" && po.status !== "RECEBIDO_PARCIAL" && po.receipts.length === 0;
  const foreign = po.currency !== "BRL";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Compra #${po.number}`}
        subtitle={
          <>
            <Link href={`/compras/fornecedores/${po.supplierId}`} className="text-gold hover:underline">{po.supplier.name}</Link>
            {" · "}
            {po.isImport ? `Importação em ${po.currency} (câmbio ${po.exchangeRate.toString()})` : "Compra nacional"}
            {" · "}solicitada por {users.get(po.requestedById) ?? "-"} em {fmtDate(po.createdAt)}
          </>
        }
        actions={
          <>
            <Badge tone={PURCHASE_STATUS_TONE[po.status]}>{PURCHASE_STATUS_LABELS[po.status]}</Badge>
            <Link href="/compras" className={btnSecondary}>Voltar</Link>
            {pending && editable && <Link href={`/compras/${po.id}/editar`} className={btnSecondary}>Editar</Link>}
            {po.status === "SOLICITADO" && editable && (
              <ActionButton action={quotePurchaseAction} fields={{ id: po.id }} className={btnSecondary}>Mover para cotação</ActionButton>
            )}
            {pending && canApprovePurchases(role) && (
              <ActionButton
                action={approvePurchaseAction}
                fields={{ id: po.id }}
                className={btnPrimary}
                confirm="Aprovar a compra e gerar as contas a pagar?"
              >
                Aprovar compra
              </ActionButton>
            )}
            {cancellable && (editable || canApprovePurchases(role)) && (
              <ActionButton action={cancelPurchaseAction} fields={{ id: po.id }} className={btnDanger} prompt="Motivo do cancelamento:">
                Cancelar
              </ActionButton>
            )}
          </>
        }
      />
      {pending && !canApprovePurchases(role) && (
        <p className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-xs text-info">
          Aguardando aprovação da diretoria. Contas a pagar são geradas na aprovação.
        </p>
      )}
      {po.approvedAt && (
        <p className="text-xs text-ink-muted">Aprovada por {users.get(po.approvedById ?? "") ?? "-"} em {fmtDateTime(po.approvedAt)}.</p>
      )}

      <Card title="Itens e custo de entrada">
        <Table
          head={
            <>
              <th className={thCls}>Produto</th>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Recebido</th>
              <th className={thCls}>A receber</th>
              {costs && (
                <>
                  {foreign && <th className={thCls}>Custo unit. ({po.currency})</th>}
                  <th className={thCls}>Mercadoria (R$)</th>
                  <th className={thCls}>Rateio despesas</th>
                  <th className={thCls}>Custo de entrada unit.</th>
                </>
              )}
            </>
          }
        >
          {po.items.map((i) => {
            const l = landed.byItem.get(i.id);
            return (
              <tr key={i.id}>
                <td className={tdCls}>
                  <span className="font-semibold">{i.product.sku}</span>
                  <div className="text-[11px] text-ink-faint">{i.product.name}</div>
                </td>
                <td className={`${tdCls} tabular-nums`}>{i.quantity}</td>
                <td className={`${tdCls} tabular-nums`}>{i.receivedQty}</td>
                <td className={`${tdCls} tabular-nums`}>{i.quantity - i.receivedQty}</td>
                {costs && (
                  <>
                    {foreign && <td className={`${tdCls} tabular-nums`}>{i.unitCostForeign.toFixed(4)}</td>}
                    <td className={`${tdCls} tabular-nums`}>{fmtMoney(l?.brlTotal)}</td>
                    <td className={`${tdCls} tabular-nums`}>{fmtMoney(l?.share)}</td>
                    <td className={`${tdCls} tabular-nums font-semibold`}>
                      {l ? `R$ ${l.landedUnitCost.toFixed(4).replace(".", ",")}` : "-"}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </Table>
        {costs && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-4">
            <span className="text-ink-muted">Frete</span><span className="tabular-nums">{fmtMoney(po.freight)}</span>
            <span className="text-ink-muted">Seguro</span><span className="tabular-nums">{fmtMoney(po.insurance)}</span>
            <span className="text-ink-muted">Despesas aduaneiras</span><span className="tabular-nums">{fmtMoney(po.customsExpenses)}</span>
            <span className="text-ink-muted">Tributos de importação</span><span className="tabular-nums">{fmtMoney(po.importTaxes)}</span>
            <span className="text-ink-muted">Outras despesas</span><span className="tabular-nums">{fmtMoney(po.otherExpenses)}</span>
            <span className="text-ink-muted">Mercadorias</span><span className="tabular-nums">{fmtMoney(totals.goods)}</span>
            <span className="font-semibold text-ink">Total da compra</span><span className="font-semibold tabular-nums">{fmtMoney(totals.total)}</span>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-faint">
          Rateio: {ALLOCATION_LABELS[landed.method]}
          {landed.fallback && " (critério por peso indisponível: há item sem peso cadastrado, rateio feito por valor)"}.
          No recebimento, o custo do produto passa a ser a média ponderada entre o saldo atual e esta entrada.
        </p>
      </Card>

      {receivable && (
        <Card title="Registrar recebimento">
          <ActionForm action={receivePurchaseAction} resetOnSuccess>
            <input type="hidden" name="id" value={po.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {po.items
                .filter((i) => i.quantity > i.receivedQty)
                .map((i) => (
                  <Field key={i.id} label={`${i.product.sku} (saldo ${i.quantity - i.receivedQty})`}>
                    <input
                      name={`qty_${i.id}`}
                      type="number"
                      min={0}
                      max={i.quantity - i.receivedQty}
                      step={1}
                      placeholder="0"
                      className={inputCls}
                    />
                  </Field>
                ))}
              <Field label="Nota fiscal do fornecedor"><input name="invoiceNumber" className={inputCls} /></Field>
              <Field label="Conferência / observações" className="sm:col-span-2"><input name="notes" className={inputCls} /></Field>
            </div>
            <div className="mt-3">
              <button className={btnPrimary}>Confirmar entrada no estoque</button>
            </div>
          </ActionForm>
        </Card>
      )}

      <Card title="Recebimentos">
        {po.receipts.length === 0 ? (
          <EmptyState>Nenhum recebimento registrado.</EmptyState>
        ) : (
          <Table head={<><th className={thCls}>Data</th><th className={thCls}>Responsável</th><th className={thCls}>NF</th><th className={thCls}>Itens</th><th className={thCls}>Observações</th></>}>
            {po.receipts.map((r) => (
              <tr key={r.id}>
                <td className={tdCls}>{fmtDateTime(r.createdAt)}</td>
                <td className={tdCls}>{users.get(r.userId) ?? "-"}</td>
                <td className={tdCls}>{r.invoiceNumber ?? "-"}</td>
                <td className={tdCls}>
                  {((r.items as ReceiptItem[]) ?? []).map((it) => (
                    <div key={it.itemId}>
                      {it.sku}: {it.quantity}
                      {costs && <span className="text-ink-faint"> (R$ {Number(it.landedUnitCost).toFixed(4).replace(".", ",")})</span>}
                    </div>
                  ))}
                </td>
                <td className={tdCls}>{r.notes ?? "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {canView(role, "financeiro") || costs ? (
        <Card title="Contas a pagar vinculadas">
          {po.payables.length === 0 ? (
            <EmptyState>Geradas automaticamente quando a compra é aprovada.</EmptyState>
          ) : (
            <Table head={<><th className={thCls}>Parcela</th><th className={thCls}>Vencimento</th><th className={thCls}>Valor</th><th className={thCls}>Pago</th><th className={thCls}>Aprovação pagto.</th><th className={thCls}>Status</th></>}>
              {po.payables.map((p) => (
                <tr key={p.id}>
                  <td className={tdCls}>{p.installment}</td>
                  <td className={tdCls}>{fmtDate(p.dueDate)}</td>
                  <td className={`${tdCls} tabular-nums`}>{fmtMoney(p.amount)}</td>
                  <td className={`${tdCls} tabular-nums`}>{fmtMoney(p.paidAmount)}</td>
                  <td className={tdCls}>{p.approvedAt ? fmtDate(p.approvedAt) : "Pendente"}</td>
                  <td className={tdCls}><Badge>{FIN_STATUS_LABELS[p.status]}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : null}

      {(po.quoteNotes || po.notes) && (
        <Card title="Cotações e observações">
          {po.quoteNotes && <p className="whitespace-pre-wrap text-[13px] text-ink">{po.quoteNotes}</p>}
          {po.notes && <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-muted">{po.notes}</p>}
          {po.expectedAt && <p className="mt-2 text-xs text-ink-faint">Previsão de entrega: {fmtDate(po.expectedAt)}</p>}
        </Card>
      )}
    </div>
  );
}
