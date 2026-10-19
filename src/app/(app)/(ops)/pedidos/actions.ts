"use server";

import { z } from "zod";
import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, num, int, date, type ActionResult } from "@/lib/erp/action-result";
import {
  saveQuote,
  submitOrder,
  approveOrder,
  rejectOrder,
  cancelOrder,
  getOrderForSession,
  type OrderInput,
} from "@/lib/erp/orders";
import { emitForOrder } from "@/lib/erp/fiscal";

const itemsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().min(0),
      discountPct: z.number().min(0).max(100),
    }),
  )
  .min(1, "Inclua pelo menos um item.");

function readOrderInput(fd: FormData): OrderInput {
  const contactId = str(fd, "contactId");
  if (!contactId) throw new Error("Selecione o cliente.");
  let rawItems: unknown;
  try {
    rawItems = JSON.parse(str(fd, "items") ?? "[]");
  } catch {
    throw new Error("Itens inválidos.");
  }
  const parsed = itemsSchema.safeParse(rawItems);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Itens inválidos.");
  return {
    contactId,
    sellerId: str(fd, "sellerId"),
    paymentMethod: str(fd, "paymentMethod"),
    installments: int(fd, "installments") ?? 1,
    firstDueDays: int(fd, "firstDueDays") ?? 30,
    intervalDays: int(fd, "intervalDays") ?? 30,
    discountTotal: num(fd, "discountTotal") ?? 0,
    freight: num(fd, "freight") ?? 0,
    otherExpenses: num(fd, "otherExpenses") ?? 0,
    carrier: str(fd, "carrier"),
    shippingMode: str(fd, "shippingMode"),
    freightPayer: str(fd, "freightPayer"),
    billingAddress: str(fd, "billingAddress"),
    shippingAddress: str(fd, "shippingAddress"),
    notes: str(fd, "notes"),
    internalNotes: str(fd, "internalNotes"),
    validUntil: date(fd, "validUntil"),
    items: parsed.data,
  };
}

export async function saveQuoteAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("pedidos");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const orderId = str(fd, "orderId") ?? undefined;
    const order = await saveQuote(session, companyId, readOrderInput(fd), orderId);
    return { ok: true, message: "Cotação salva.", redirectTo: `/pedidos/${order.id}` };
  });
}

export async function submitOrderAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("pedidos");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const res = await submitOrder(session, companyId, str(fd, "orderId") ?? "");
    return {
      ok: true,
      message: res?.status === "APROVADO" ? "Pedido aprovado automaticamente e estoque reservado." : "Enviado para aprovação.",
    };
  });
}

export async function approveOrderAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("pedidos");
  const companyId = await activeCompanyId(session);
  return runAction(() => approveOrder(session, companyId, str(fd, "orderId") ?? ""));
}

export async function rejectOrderAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("pedidos");
  const companyId = await activeCompanyId(session);
  return runAction(() => rejectOrder(session, companyId, str(fd, "orderId") ?? "", str(fd, "reason") ?? ""));
}

export async function cancelOrderAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("pedidos");
  const companyId = await activeCompanyId(session);
  return runAction(() => cancelOrder(session, companyId, str(fd, "orderId") ?? "", str(fd, "reason") ?? ""));
}

/** Emissão a partir da tela do pedido — a checagem de permissão do Fiscal
 * fica dentro de emitForOrder. */
export async function emitInvoiceAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("fiscal");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const doc = await emitForOrder(session, companyId, str(fd, "orderId") ?? "");
    if (doc.status === "AUTORIZADA") return { ok: true, message: `NF-e ${doc.number} autorizada.` };
    return { ok: false, error: `NF-e rejeitada (${doc.rejectionCode}): ${doc.rejectionReason}` };
  });
}

/** Copia itens e condições de um pedido existente para uma cotação nova,
 * com os preços de tabela atuais revalidados por saveQuote. */
export async function duplicateOrderAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("pedidos");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const source = await getOrderForSession(session, companyId, str(fd, "orderId") ?? "");
    if (!source) throw new Error("Pedido não encontrado.");
    const order = await saveQuote(session, companyId, {
      contactId: source.contactId,
      sellerId: source.sellerId,
      paymentMethod: source.paymentMethod,
      installments: source.installments,
      firstDueDays: source.firstDueDays,
      intervalDays: source.intervalDays,
      freight: source.freight.toNumber(),
      carrier: source.carrier,
      shippingMode: source.shippingMode,
      freightPayer: source.freightPayer,
      billingAddress: source.billingAddress,
      shippingAddress: source.shippingAddress,
      notes: source.notes,
      items: source.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toNumber(),
        discountPct: i.discountPct.toNumber(),
      })),
    });
    return { ok: true, message: "Cotação duplicada.", redirectTo: `/pedidos/${order.id}` };
  });
}
