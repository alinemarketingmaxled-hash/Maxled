"use server";

import type { StockMovementType } from "@/generated/prisma/client";
import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, int, type ActionResult } from "@/lib/erp/action-result";
import { manualMovement, applyInventoryCount, transferBetweenCompanies } from "@/lib/erp/inventory";
import { prisma } from "@/lib/prisma";

export async function manualMovementAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("estoque");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const sku = (str(fd, "sku") ?? "").toUpperCase();
    const product = await prisma.product.findFirst({ where: { companyId, sku, deletedAt: null }, select: { id: true } });
    if (!product) return { ok: false, error: `SKU ${sku || "(vazio)"} não encontrado nesta empresa.` };
    const { skipped } = await manualMovement(session, companyId, {
      productId: product.id,
      type: (str(fd, "type") ?? "") as StockMovementType,
      quantity: int(fd, "quantity") ?? 0,
      reason: str(fd, "reason") ?? "",
      lot: str(fd, "lot"),
      serial: str(fd, "serial"),
      documentRef: str(fd, "documentRef"),
      requestKey: str(fd, "requestKey") ?? "",
    });
    return { ok: true, message: skipped ? "Movimento já registrado anteriormente." : "Movimento registrado." };
  });
}

export async function inventoryAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("estoque");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const counts: { productId: string; counted: number }[] = [];
    for (const [key, value] of fd.entries()) {
      if (!key.startsWith("count:") || typeof value !== "string" || value.trim() === "") continue;
      counts.push({ productId: key.slice(6), counted: Number(value) });
    }
    if (counts.length === 0) return { ok: false, error: "Nenhuma quantidade contada informada." };
    const adjusted = await applyInventoryCount(session, companyId, counts, str(fd, "requestKey") ?? "");
    return { ok: true, message: adjusted === 0 ? "Nenhuma divergência: nada a ajustar." : `${adjusted} ajuste(s) de inventário lançado(s).` };
  });
}

export async function transferAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("estoque");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const skus = fd.getAll("itemSku").map(String);
    const qtys = fd.getAll("itemQty").map(String);
    await transferBetweenCompanies(session, companyId, {
      toCompanyId: str(fd, "toCompanyId") ?? "",
      items: skus.map((sku, i) => ({ sku, quantity: Number(qtys[i] ?? 0) })),
      documentRef: str(fd, "documentRef"),
      notes: str(fd, "notes"),
      requestKey: str(fd, "requestKey") ?? "",
    });
    return { ok: true, message: "Transferência registrada." };
  });
}
