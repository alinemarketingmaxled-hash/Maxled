"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireEditAction, requireViewAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, num, int, date, bool, type ActionResult } from "@/lib/erp/action-result";
import {
  savePurchase,
  movePurchaseToQuote,
  approvePurchase,
  cancelPurchase,
  receivePurchase,
  type PurchaseInput,
  type CostAllocation,
} from "@/lib/erp/purchasing";

const itemsSchema = z.array(
  z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    unitCostForeign: z.coerce.number().min(0),
  }),
);

function readPurchase(fd: FormData): PurchaseInput {
  const supplierId = str(fd, "supplierId");
  if (!supplierId) throw new Error("Selecione o fornecedor.");
  let items: PurchaseInput["items"];
  try {
    items = itemsSchema.parse(JSON.parse(str(fd, "items") ?? "[]"));
  } catch {
    throw new Error("Itens inválidos: confira produto, quantidade inteira e custo.");
  }
  const alloc = str(fd, "costAllocation");
  return {
    supplierId,
    isImport: bool(fd, "isImport"),
    currency: str(fd, "currency") ?? "BRL",
    exchangeRate: num(fd, "exchangeRate") ?? 1,
    freight: num(fd, "freight") ?? 0,
    insurance: num(fd, "insurance") ?? 0,
    customsExpenses: num(fd, "customsExpenses") ?? 0,
    importTaxes: num(fd, "importTaxes") ?? 0,
    otherExpenses: num(fd, "otherExpenses") ?? 0,
    costAllocation: (alloc === "QUANTIDADE" || alloc === "PESO" ? alloc : "VALOR") as CostAllocation,
    installments: int(fd, "installments") ?? 1,
    firstDueDays: int(fd, "firstDueDays") ?? 30,
    intervalDays: int(fd, "intervalDays") ?? 30,
    expectedAt: date(fd, "expectedAt"),
    quoteNotes: str(fd, "quoteNotes"),
    notes: str(fd, "notes"),
    items,
  };
}

export async function savePurchaseAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("compras");
  return runAction(async () => {
    const companyId = await activeCompanyId(session);
    const id = str(fd, "id") ?? undefined;
    const po = await savePurchase(session, companyId, readPurchase(fd), id);
    return { ok: true, redirectTo: `/compras/${po.id}` };
  });
}

export async function quotePurchaseAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("compras");
  return runAction(async () => {
    await movePurchaseToQuote(session, await activeCompanyId(session), str(fd, "id") ?? "");
  });
}

/** Aprovação/cancelamento: a regra fina de perfil fica em purchasing.ts. */
export async function approvePurchaseAction(fd: FormData): Promise<ActionResult> {
  const session = await requireViewAction("compras");
  return runAction(async () => {
    await approvePurchase(session, await activeCompanyId(session), str(fd, "id") ?? "");
    return { ok: true, message: "Compra aprovada; contas a pagar geradas." };
  });
}

export async function cancelPurchaseAction(fd: FormData): Promise<ActionResult> {
  const session = await requireViewAction("compras");
  return runAction(async () => {
    await cancelPurchase(session, await activeCompanyId(session), str(fd, "id") ?? "", str(fd, "reason") ?? "");
  });
}

export async function receivePurchaseAction(fd: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return runAction(async () => {
    const quantities: Record<string, number> = {};
    for (const [k, v] of fd.entries()) {
      if (k.startsWith("qty_") && typeof v === "string" && v.trim()) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) throw new Error("Quantidades devem ser inteiras.");
        quantities[k.slice(4)] = n;
      }
    }
    await receivePurchase(session, await activeCompanyId(session), str(fd, "id") ?? "", {
      requestKey: str(fd, "requestKey") ?? "",
      invoiceNumber: str(fd, "invoiceNumber"),
      notes: str(fd, "notes"),
      quantities,
    });
    return { ok: true, message: "Recebimento registrado e estoque atualizado." };
  });
}
