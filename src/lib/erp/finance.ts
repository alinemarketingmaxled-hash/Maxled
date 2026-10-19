import "server-only";
import type { Session } from "next-auth";
import { Prisma, type FinancialStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canApprovePayables, canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { addDays, D, round2, splitInstallments } from "@/lib/erp/money";

type Tx = Prisma.TransactionClient;

export class FinanceError extends Error {}

export const FIN_STATUS_LABELS: Record<FinancialStatus, string> = {
  ABERTO: "Em aberto",
  PARCIAL: "Parcial",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

export const PAYABLE_CATEGORIES = [
  "Fornecedores",
  "Importação",
  "Frete",
  "Impostos",
  "Folha",
  "Aluguel",
  "Serviços",
  "Marketing",
  "Tarifas bancárias",
  "Outros",
];

function statusFor(amount: Prisma.Decimal, paid: Prisma.Decimal): FinancialStatus {
  if (paid.greaterThanOrEqualTo(amount)) return "PAGO";
  if (paid.greaterThan(0)) return "PARCIAL";
  return "ABERTO";
}

/** Contas a receber nascem da nota autorizada (§5: pedido/documento →
 * contas a receber), uma por parcela. A unique (orderId, installment)
 * garante que reprocessar a autorização nunca duplica títulos. */
export async function createReceivablesForOrder(tx: Tx, orderId: string, fiscalDocumentId: string, baseDate: Date) {
  const order = await tx.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true, companyId: true, contactId: true, number: true, total: true,
      installments: true, firstDueDays: true, intervalDays: true, paymentMethod: true,
    },
  });
  const parts = splitInstallments(order.total, order.installments);
  await tx.receivable.createMany({
    skipDuplicates: true,
    data: parts.map((amount, i) => ({
      companyId: order.companyId,
      contactId: order.contactId,
      orderId: order.id,
      fiscalDocumentId,
      installment: i + 1,
      installmentsTotal: parts.length,
      description: `Pedido ${order.number} - parcela ${i + 1}/${parts.length}`,
      amount,
      dueDate: addDays(baseDate, order.firstDueDays + i * order.intervalDays),
      paymentMethod: order.paymentMethod,
    })),
  });
}

export async function cancelOpenReceivablesForOrder(tx: Tx, orderId: string) {
  const paid = await tx.receivable.count({ where: { orderId, paidAmount: { gt: 0 }, status: { not: "CANCELADO" } } });
  if (paid > 0) throw new FinanceError("Há parcelas com pagamento registrado: estorne no Financeiro antes de cancelar.");
  await tx.receivable.updateMany({
    where: { orderId, status: { in: ["ABERTO", "PARCIAL"] } },
    data: { status: "CANCELADO", cancelledAt: new Date() },
  });
}

export type PaymentInput = { amount: number; paidAt: Date; method?: string | null; notes?: string | null; requestKey: string };

/** Baixa (total ou parcial). O título é travado com SELECT ... FOR UPDATE e
 * a requestKey do formulário é única: duplo clique ou reenvio não baixam
 * duas vezes. */
export async function registerReceivablePayment(session: Session, companyId: string, receivableId: string, input: PaymentInput) {
  if (!canEdit(session.user.role, "financeiro")) throw new FinanceError("Sem permissão no Financeiro.");
  if (!input.requestKey) throw new FinanceError("Requisição inválida.");
  return prisma.$transaction(async (tx) => {
    if (await tx.receivablePayment.findUnique({ where: { requestKey: input.requestKey } })) return;
    await tx.$queryRaw`SELECT id FROM "Receivable" WHERE id = ${receivableId} FOR UPDATE`;
    const r = await tx.receivable.findFirst({ where: { id: receivableId, companyId } });
    if (!r) throw new FinanceError("Título não encontrado.");
    if (r.status === "CANCELADO" || r.status === "PAGO") throw new FinanceError("Título já quitado ou cancelado.");
    const amount = round2(input.amount);
    const remaining = r.amount.sub(r.paidAmount);
    if (amount.lessThanOrEqualTo(0) || amount.greaterThan(remaining)) {
      throw new FinanceError(`Valor deve estar entre R$ 0,01 e o saldo de R$ ${remaining.toFixed(2)}.`);
    }
    const paidAmount = r.paidAmount.add(amount);
    await tx.receivablePayment.create({
      data: {
        receivableId: r.id, amount, paidAt: input.paidAt, method: input.method ?? null,
        notes: input.notes ?? null, userId: session.user.id, requestKey: input.requestKey,
      },
    });
    await tx.receivable.update({ where: { id: r.id }, data: { paidAmount, status: statusFor(r.amount, paidAmount) } });
    await logActivity(
      { actorId: session.user.id, entityType: "Receivable", entityId: r.id, action: "paid", diff: { amount: amount.toString() }, companyId },
      tx,
    );
  });
}

export async function registerPayablePayment(session: Session, companyId: string, payableId: string, input: PaymentInput) {
  if (!canEdit(session.user.role, "financeiro")) throw new FinanceError("Sem permissão no Financeiro.");
  if (!input.requestKey) throw new FinanceError("Requisição inválida.");
  return prisma.$transaction(async (tx) => {
    if (await tx.payablePayment.findUnique({ where: { requestKey: input.requestKey } })) return;
    await tx.$queryRaw`SELECT id FROM "Payable" WHERE id = ${payableId} FOR UPDATE`;
    const p = await tx.payable.findFirst({ where: { id: payableId, companyId } });
    if (!p) throw new FinanceError("Conta não encontrada.");
    if (!p.approvedAt) throw new FinanceError("Conta ainda não aprovada pela diretoria.");
    if (p.status === "CANCELADO" || p.status === "PAGO") throw new FinanceError("Conta já paga ou cancelada.");
    const amount = round2(input.amount);
    const remaining = p.amount.sub(p.paidAmount);
    if (amount.lessThanOrEqualTo(0) || amount.greaterThan(remaining)) {
      throw new FinanceError(`Valor deve estar entre R$ 0,01 e o saldo de R$ ${remaining.toFixed(2)}.`);
    }
    const paidAmount = p.paidAmount.add(amount);
    await tx.payablePayment.create({
      data: {
        payableId: p.id, amount, paidAt: input.paidAt, method: input.method ?? null,
        notes: input.notes ?? null, userId: session.user.id, requestKey: input.requestKey,
      },
    });
    await tx.payable.update({ where: { id: p.id }, data: { paidAmount, status: statusFor(p.amount, paidAmount) } });
    await logActivity(
      { actorId: session.user.id, entityType: "Payable", entityId: p.id, action: "paid", diff: { amount: amount.toString() }, companyId },
      tx,
    );
  });
}

export type PayableInput = {
  supplierId?: string | null;
  description: string;
  category: string;
  documentNumber?: string | null;
  amount: number;
  dueDate: Date;
  notes?: string | null;
  attachmentUrl?: string | null;
};

export async function createPayable(session: Session, companyId: string, input: PayableInput) {
  if (!canEdit(session.user.role, "financeiro")) throw new FinanceError("Sem permissão no Financeiro.");
  if (!input.description.trim()) throw new FinanceError("Informe a descrição.");
  const amount = round2(input.amount);
  if (amount.lessThanOrEqualTo(0)) throw new FinanceError("Valor deve ser maior que zero.");
  if (input.supplierId) {
    const ok = await prisma.supplier.findFirst({ where: { id: input.supplierId, companyId } });
    if (!ok) throw new FinanceError("Fornecedor inválido.");
  }
  const payable = await prisma.payable.create({
    data: {
      companyId,
      supplierId: input.supplierId || null,
      description: input.description.trim(),
      category: input.category || "Outros",
      documentNumber: input.documentNumber ?? null,
      amount,
      dueDate: input.dueDate,
      notes: input.notes ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      createdById: session.user.id,
    },
  });
  await logActivity({ actorId: session.user.id, entityType: "Payable", entityId: payable.id, action: "created", companyId });
  return payable;
}

export async function approvePayable(session: Session, companyId: string, payableId: string) {
  if (!canApprovePayables(session.user.role)) throw new FinanceError("Apenas a diretoria aprova pagamentos.");
  const res = await prisma.payable.updateMany({
    where: { id: payableId, companyId, approvedAt: null, status: { not: "CANCELADO" } },
    data: { approvedAt: new Date(), approvedById: session.user.id },
  });
  if (res.count === 1) {
    await logActivity({ actorId: session.user.id, entityType: "Payable", entityId: payableId, action: "approved", companyId });
  }
}

export async function cancelPayable(session: Session, companyId: string, payableId: string) {
  if (!canEdit(session.user.role, "financeiro")) throw new FinanceError("Sem permissão no Financeiro.");
  const res = await prisma.payable.updateMany({
    where: { id: payableId, companyId, paidAmount: 0, status: "ABERTO" },
    data: { status: "CANCELADO", cancelledAt: new Date() },
  });
  if (res.count !== 1) throw new FinanceError("Só contas sem pagamento podem ser canceladas.");
  await logActivity({ actorId: session.user.id, entityType: "Payable", entityId: payableId, action: "cancelled", companyId });
}

/** Conciliação manual: marca a baixa como conferida com o extrato. */
export async function toggleReconciled(session: Session, companyId: string, kind: "receivable" | "payable", paymentId: string) {
  if (!canEdit(session.user.role, "financeiro")) throw new FinanceError("Sem permissão no Financeiro.");
  if (kind === "receivable") {
    const p = await prisma.receivablePayment.findFirst({ where: { id: paymentId, receivable: { companyId } } });
    if (!p) throw new FinanceError("Pagamento não encontrado.");
    await prisma.receivablePayment.update({
      where: { id: p.id },
      data: p.reconciled
        ? { reconciled: false, reconciledAt: null, reconciledById: null }
        : { reconciled: true, reconciledAt: new Date(), reconciledById: session.user.id },
    });
  } else {
    const p = await prisma.payablePayment.findFirst({ where: { id: paymentId, payable: { companyId } } });
    if (!p) throw new FinanceError("Pagamento não encontrado.");
    await prisma.payablePayment.update({
      where: { id: p.id },
      data: p.reconciled
        ? { reconciled: false, reconciledAt: null, reconciledById: null }
        : { reconciled: true, reconciledAt: new Date(), reconciledById: session.user.id },
    });
  }
  await logActivity({ actorId: session.user.id, entityType: kind === "receivable" ? "Receivable" : "Payable", entityId: paymentId, action: "reconciled", companyId });
}

/** Fluxo de caixa por dia: realizado (baixas) nos últimos `pastDays` e
 * previsto (saldos em aberto por vencimento) nos próximos `futureDays`. */
export async function getCashFlow(companyIds: string[], pastDays = 30, futureDays = 60) {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const from = addDays(today, -pastDays);
  const to = addDays(today, futureDays);

  const [inPaid, outPaid, inOpen, outOpen] = await Promise.all([
    prisma.receivablePayment.findMany({
      where: { receivable: { companyId: { in: companyIds } }, paidAt: { gte: from, lt: addDays(today, 1) } },
      select: { amount: true, paidAt: true },
    }),
    prisma.payablePayment.findMany({
      where: { payable: { companyId: { in: companyIds } }, paidAt: { gte: from, lt: addDays(today, 1) } },
      select: { amount: true, paidAt: true },
    }),
    prisma.receivable.findMany({
      where: { companyId: { in: companyIds }, status: { in: ["ABERTO", "PARCIAL"] }, dueDate: { lt: to } },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
    prisma.payable.findMany({
      where: { companyId: { in: companyIds }, status: { in: ["ABERTO", "PARCIAL"] }, dueDate: { lt: to } },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
  ]);

  const key = (d: Date) => d.toISOString().slice(0, 10);
  const days = new Map<string, { date: string; inflow: Prisma.Decimal; outflow: Prisma.Decimal; projected: boolean }>();
  const bucket = (d: Date, projected: boolean) => {
    // Vencidos em aberto entram no "hoje" do previsto.
    const day = projected && d < today ? today : d;
    // Realizado e previsto do mesmo dia (hoje) ficam em linhas separadas.
    const k = `${key(day)}:${projected ? "p" : "r"}`;
    if (!days.has(k)) days.set(k, { date: key(day), inflow: D(0), outflow: D(0), projected });
    return days.get(k)!;
  };
  for (const p of inPaid) bucket(p.paidAt, false).inflow = bucket(p.paidAt, false).inflow.add(p.amount);
  for (const p of outPaid) bucket(p.paidAt, false).outflow = bucket(p.paidAt, false).outflow.add(p.amount);
  for (const r of inOpen) {
    const b = bucket(r.dueDate, true);
    b.inflow = b.inflow.add(r.amount.sub(r.paidAmount));
  }
  for (const r of outOpen) {
    const b = bucket(r.dueDate, true);
    b.outflow = b.outflow.add(r.amount.sub(r.paidAmount));
  }
  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.projected) - Number(b.projected))
    .map((d) => ({ date: d.date, inflow: d.inflow.toNumber(), outflow: d.outflow.toNumber(), projected: d.projected }));
}
