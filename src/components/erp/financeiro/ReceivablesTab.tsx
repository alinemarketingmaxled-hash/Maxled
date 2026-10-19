import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime, fmtMoney, orderCode } from "@/lib/erp/format";
import { ActionButton } from "@/components/erp/ActionForm";
import { EmptyState, Field, Tabs, btnSecondary, inputCls } from "@/components/erp/ui";
import { payReceivableAction, toggleReconciledAction } from "@/app/(app)/(ops)/financeiro/actions";
import { FinStatusBadge, PaymentForm, buildQuery, startOfToday } from "./shared";

export type FinParams = { aba?: string; sit?: string; cliente?: string; de?: string; ate?: string; pedido?: string; pend?: string };

const SITS = [
  { key: "abertos", label: "Em aberto" },
  { key: "vencidos", label: "Vencidos" },
  { key: "pagos", label: "Pagos" },
  { key: "cancelados", label: "Cancelados" },
];

function dateParam(v?: string, endOfDay = false) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00-03:00`);
  return endOfDay ? new Date(d.getTime() + 86_400_000) : d;
}

export async function ReceivablesTab({ companyId, companyCode, params, editable }: { companyId: string; companyCode: string; params: FinParams; editable: boolean }) {
  const sit = SITS.some((s) => s.key === params.sit) ? params.sit! : "abertos";
  const today = startOfToday();
  const from = dateParam(params.de);
  const to = dateParam(params.ate, true);
  const orderNumber = params.pedido && /^\d+$/.test(params.pedido) ? Number(params.pedido) : undefined;
  const q = params.cliente?.trim();

  const base: Prisma.ReceivableWhereInput = {
    companyId,
    ...(from || to ? { dueDate: { gte: from, lt: to } } : {}),
    ...(orderNumber ? { order: { number: orderNumber } } : {}),
    ...(q
      ? {
          contact: {
            OR: [
              { accountName: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { cnpj: { contains: q } },
            ],
          },
        }
      : {}),
  };
  const bySit: Record<string, Prisma.ReceivableWhereInput> = {
    abertos: { ...base, status: { in: ["ABERTO", "PARCIAL"] } },
    vencidos: { ...base, status: { in: ["ABERTO", "PARCIAL"] }, dueDate: { ...(from ? { gte: from } : {}), lt: to && to < today ? to : today } },
    pagos: { ...base, status: "PAGO" },
    cancelados: { ...base, status: "CANCELADO" },
  };

  const [counts, rows] = await Promise.all([
    Promise.all(SITS.map((s) => prisma.receivable.count({ where: bySit[s.key] }))),
    prisma.receivable.findMany({
      where: bySit[sit],
      orderBy: sit === "pagos" ? { updatedAt: "desc" } : { dueDate: "asc" },
      take: 200,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, accountName: true } },
        order: { select: { id: true, number: true } },
        fiscalDocument: { select: { id: true, number: true } },
        payments: { orderBy: { paidAt: "asc" } },
      },
    }),
  ]);

  const keep = { aba: "receber", sit, cliente: params.cliente, de: params.de, ate: params.ate, pedido: params.pedido };

  return (
    <div className="flex flex-col gap-3">
      <form action="/financeiro" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="aba" value="receber" />
        <input type="hidden" name="sit" value={sit} />
        <Field label="Cliente / CNPJ">
          <input name="cliente" defaultValue={params.cliente} className={`${inputCls} w-48`} />
        </Field>
        <Field label="Vencimento de">
          <input type="date" name="de" defaultValue={params.de} className={inputCls} />
        </Field>
        <Field label="até">
          <input type="date" name="ate" defaultValue={params.ate} className={inputCls} />
        </Field>
        <Field label="Nº pedido">
          <input name="pedido" inputMode="numeric" defaultValue={params.pedido} className={`${inputCls} w-28`} />
        </Field>
        <button className={btnSecondary}>Filtrar</button>
      </form>

      <Tabs
        tabs={SITS.map((s, i) => ({ key: s.key, label: s.label, count: counts[i], href: buildQuery(keep, { sit: s.key }) }))}
        active={sit}
      />

      {rows.length === 0 ? (
        <EmptyState>Nenhum título nesta situação.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const remaining = r.amount.sub(r.paidAmount).toNumber();
            const overdue = r.dueDate < today;
            const name = r.contact.accountName || `${r.contact.firstName} ${r.contact.lastName}`;
            return (
              <li key={r.id} className="rounded-xl border border-gold-deep/25 bg-surface">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{name}</span>
                      <span className="text-xs text-ink-muted">
                        {r.description}
                        {r.order && <> · pedido {orderCode(companyCode, r.order.number)}</>}
                        {r.fiscalDocument && <> · NF-e {r.fiscalDocument.number}</>}
                      </span>
                    </span>
                    <span className="text-xs text-ink-muted">Venc. {fmtDate(r.dueDate)}</span>
                    <span className="text-right tabular-nums">
                      <span className="block font-semibold">{fmtMoney(r.amount)}</span>
                      {r.paidAmount.greaterThan(0) && <span className="text-[11px] text-ink-muted">pago {fmtMoney(r.paidAmount)}</span>}
                    </span>
                    <FinStatusBadge status={r.status} overdue={overdue} />
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-gold-deep/20 px-4 py-3">
                    <p className="flex flex-wrap gap-3 text-xs">
                      {r.order && (
                        <Link href={`/pedidos/${r.order.id}`} className="text-gold underline">
                          Abrir pedido
                        </Link>
                      )}
                      {r.fiscalDocument && (
                        <Link href={`/fiscal/${r.fiscalDocument.id}`} className="text-gold underline">
                          Abrir nota fiscal
                        </Link>
                      )}
                      <span className="text-ink-muted">
                        Parcela {r.installment}/{r.installmentsTotal} · {r.paymentMethod ?? "forma não definida"}
                      </span>
                    </p>
                    {editable && (r.status === "ABERTO" || r.status === "PARCIAL") && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
                          Registrar recebimento (saldo {fmtMoney(remaining)})
                        </p>
                        <PaymentForm action={payReceivableAction} id={r.id} remaining={remaining} label="Baixar" />
                      </div>
                    )}
                    {r.payments.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Liquidações</p>
                        <ul className="flex flex-col gap-1.5 text-sm">
                          {r.payments.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="tabular-nums">{fmtMoney(p.amount)}</span>
                              <span className="text-xs text-ink-muted">
                                {fmtDate(p.paidAt)} · {p.method ?? "-"} {p.notes ? `· ${p.notes}` : ""}
                              </span>
                              <span className="text-xs">{p.reconciled ? `Conciliado em ${fmtDateTime(p.reconciledAt)}` : "Não conciliado"}</span>
                              {editable && (
                                <ActionButton action={toggleReconciledAction} fields={{ kind: "receivable", id: p.id }} className="text-xs text-gold underline">
                                  {p.reconciled ? "Desfazer conciliação" : "Conciliar"}
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
