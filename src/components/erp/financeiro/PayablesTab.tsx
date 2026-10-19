import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYABLE_CATEGORIES } from "@/lib/erp/finance";
import { fmtDate, fmtDateTime, fmtMoney, toDateInput } from "@/lib/erp/format";
import { ActionButton, ActionForm } from "@/components/erp/ActionForm";
import { Badge, Card, EmptyState, Field, Tabs, btnDanger, btnPrimary, inputCls } from "@/components/erp/ui";
import {
  approvePayableAction,
  cancelPayableAction,
  createPayableAction,
  payPayableAction,
  toggleReconciledAction,
} from "@/app/(app)/(ops)/financeiro/actions";
import { FinStatusBadge, PaymentForm, buildQuery, startOfToday } from "./shared";

const SITS = [
  { key: "aprovar", label: "A aprovar" },
  { key: "pagar", label: "A pagar" },
  { key: "vencidas", label: "Vencidas" },
  { key: "pagas", label: "Pagas" },
  { key: "canceladas", label: "Canceladas" },
];

export async function PayablesTab({
  companyId,
  sit: sitParam,
  editable,
  canApprove,
}: {
  companyId: string;
  sit?: string;
  editable: boolean;
  canApprove: boolean;
}) {
  const sit = SITS.some((s) => s.key === sitParam) ? sitParam! : canApprove && !editable ? "aprovar" : "pagar";
  const today = startOfToday();
  const open = { companyId, status: { in: ["ABERTO", "PARCIAL"] } } satisfies Prisma.PayableWhereInput;
  const bySit: Record<string, Prisma.PayableWhereInput> = {
    aprovar: { ...open, approvedAt: null },
    pagar: { ...open, approvedAt: { not: null } },
    vencidas: { ...open, dueDate: { lt: today } },
    pagas: { companyId, status: "PAGO" },
    canceladas: { companyId, status: "CANCELADO" },
  };

  const [counts, rows, suppliers] = await Promise.all([
    Promise.all(SITS.map((s) => prisma.payable.count({ where: bySit[s.key] }))),
    prisma.payable.findMany({
      where: bySit[sit],
      orderBy: sit === "pagas" || sit === "canceladas" ? { updatedAt: "desc" } : { dueDate: "asc" },
      take: 200,
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { id: true, number: true } },
        payments: { orderBy: { paidAt: "asc" } },
      },
    }),
    editable
      ? prisma.supplier.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const approvers = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.approvedById).filter((v): v is string => !!v) } },
    select: { id: true, name: true },
  });
  const approverName = new Map(approvers.map((a) => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-3">
      {editable && (
        <Card title="Lançar conta a pagar">
          <ActionForm action={createPayableAction} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Descrição" className="sm:col-span-2">
              <input name="description" required className={inputCls} />
            </Field>
            <Field label="Fornecedor">
              <select name="supplierId" className={inputCls} defaultValue="">
                <option value="">Sem fornecedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoria">
              <select name="category" className={inputCls} defaultValue="Fornecedores">
                {PAYABLE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Nº documento">
              <input name="documentNumber" className={inputCls} />
            </Field>
            <Field label="Valor (R$)">
              <input name="amount" type="number" step="0.01" min="0.01" required className={inputCls} />
            </Field>
            <Field label="Vencimento">
              <input name="dueDate" type="date" required defaultValue={toDateInput(new Date())} className={inputCls} />
            </Field>
            <Field label="Link do comprovante/boleto">
              <input name="attachmentUrl" type="url" placeholder="https://" className={inputCls} />
            </Field>
            <Field label="Observações" className="sm:col-span-2 lg:col-span-3">
              <input name="notes" className={inputCls} />
            </Field>
            <div className="flex items-end">
              <button className={`${btnPrimary} w-full`}>Lançar</button>
            </div>
          </ActionForm>
        </Card>
      )}

      <Tabs
        tabs={SITS.map((s, i) => ({ key: s.key, label: s.label, count: counts[i], href: buildQuery({ aba: "pagar" }, { sit: s.key }) }))}
        active={sit}
      />

      {rows.length === 0 ? (
        <EmptyState>Nenhuma conta nesta situação.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => {
            const remaining = p.amount.sub(p.paidAmount).toNumber();
            const isOpen = p.status === "ABERTO" || p.status === "PARCIAL";
            return (
              <li key={p.id} className="rounded-xl border border-gold-deep/25 bg-surface">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{p.description}</span>
                      <span className="text-xs text-ink-muted">
                        {p.supplier?.name ?? "Sem fornecedor"} · {p.category}
                        {p.documentNumber && <> · doc. {p.documentNumber}</>}
                      </span>
                    </span>
                    <span className="text-xs text-ink-muted">Venc. {fmtDate(p.dueDate)}</span>
                    <span className="text-right tabular-nums">
                      <span className="block font-semibold">{fmtMoney(p.amount)}</span>
                      {p.paidAmount.greaterThan(0) && <span className="text-[11px] text-ink-muted">pago {fmtMoney(p.paidAmount)}</span>}
                    </span>
                    {isOpen && !p.approvedAt ? <Badge tone="warning">Aguardando aprovação</Badge> : <FinStatusBadge status={p.status} overdue={p.dueDate < today} />}
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-gold-deep/20 px-4 py-3">
                    <p className="flex flex-wrap gap-3 text-xs text-ink-muted">
                      {p.approvedAt ? (
                        <span>
                          Aprovada por {approverName.get(p.approvedById ?? "") ?? "-"} em {fmtDateTime(p.approvedAt)}
                        </span>
                      ) : (
                        <span>Ainda não aprovada pela diretoria.</span>
                      )}
                      {p.purchaseOrder && (
                        <Link href={`/compras/${p.purchaseOrder.id}`} className="text-gold underline">
                          Pedido de compra {p.purchaseOrder.number}
                        </Link>
                      )}
                      {p.attachmentUrl && (
                        <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                          Comprovante
                        </a>
                      )}
                      {p.notes && <span>{p.notes}</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canApprove && isOpen && !p.approvedAt && (
                        <ActionButton action={approvePayableAction} fields={{ id: p.id }} className={btnPrimary}>
                          Aprovar pagamento
                        </ActionButton>
                      )}
                      {editable && p.status === "ABERTO" && p.paidAmount.equals(0) && (
                        <ActionButton action={cancelPayableAction} fields={{ id: p.id }} className={btnDanger} confirm="Cancelar esta conta a pagar?">
                          Cancelar
                        </ActionButton>
                      )}
                    </div>
                    {editable && isOpen && p.approvedAt && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
                          Registrar pagamento (saldo {fmtMoney(remaining)})
                        </p>
                        <PaymentForm action={payPayableAction} id={p.id} remaining={remaining} label="Pagar" />
                      </div>
                    )}
                    {p.payments.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Pagamentos</p>
                        <ul className="flex flex-col gap-1.5 text-sm">
                          {p.payments.map((pm) => (
                            <li key={pm.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="tabular-nums">{fmtMoney(pm.amount)}</span>
                              <span className="text-xs text-ink-muted">
                                {fmtDate(pm.paidAt)} · {pm.method ?? "-"}
                              </span>
                              <span className="text-xs">{pm.reconciled ? "Conciliado" : "Não conciliado"}</span>
                              {editable && (
                                <ActionButton action={toggleReconciledAction} fields={{ kind: "payable", id: pm.id }} className="text-xs text-gold underline">
                                  {pm.reconciled ? "Desfazer conciliação" : "Conciliar"}
                                </ActionButton>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
