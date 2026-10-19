"use server";

import { redirect } from "next/navigation";
import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, int, num, bool, type ActionResult } from "@/lib/erp/action-result";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { buildAuthorizeUrl, ML_PROVIDER, saveMlConfig, syncListingStock } from "@/lib/erp/mercadolivre";
import { ML_OPERATIONS, processEvent, recordEvent, reprocessEvent } from "@/lib/erp/integrations";

export async function saveConfigAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const clientId = str(fd, "clientId");
    const redirectUri = str(fd, "redirectUri");
    if (!clientId || !redirectUri) throw new Error("Informe Client ID e URL de retorno.");
    if (!/^https?:\/\//.test(redirectUri)) throw new Error("URL de retorno deve começar com https://.");
    const defaultSellerId = str(fd, "defaultSellerId");
    if (defaultSellerId) {
      const ok = await prisma.user.findFirst({
        where: { id: defaultSellerId, deletedAt: null, OR: [{ role: "MEDIATOR" }, { companies: { some: { companyId } } }] },
      });
      if (!ok) throw new Error("Vendedor inválido para esta empresa.");
    }
    await saveMlConfig(companyId, { clientId, clientSecret: str(fd, "clientSecret"), redirectUri, defaultSellerId });
    await logActivity({
      actorId: session.user.id, entityType: "Integration", entityId: companyId, action: "updated",
      diff: { mercadoLivre: "configuração salva" }, companyId,
    });
    return { ok: true, message: "Configuração salva." };
  });
}

/** Redireciona para a tela de autorização do Mercado Livre. */
export async function connectAction() {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  const url = await buildAuthorizeUrl(companyId, session.user.id);
  redirect(url);
}

export async function saveListingAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const id = str(fd, "id");
    const externalId = str(fd, "externalId")?.toUpperCase();
    const title = str(fd, "title");
    const productId = str(fd, "productId");
    const unitsPerSale = int(fd, "unitsPerSale") ?? 1;
    if (!externalId || !title || !productId) throw new Error("Informe código do anúncio, título e produto.");
    if (unitsPerSale < 1) throw new Error("Unidades por venda deve ser 1 ou mais.");
    const product = await prisma.product.findFirst({ where: { id: productId, companyId, deletedAt: null } });
    if (!product) throw new Error("Produto inválido nesta empresa.");
    const data = { externalId, title, productId, unitsPerSale, active: bool(fd, "active") };
    if (id) {
      const res = await prisma.marketplaceListing.updateMany({ where: { id, companyId }, data });
      if (res.count !== 1) throw new Error("Anúncio não encontrado.");
    } else {
      const created = await prisma.marketplaceListing.create({ data: { ...data, companyId, channel: "MERCADO_LIVRE" } });
      await logActivity({ actorId: session.user.id, entityType: "MarketplaceListing", entityId: created.id, action: "created", companyId });
      return { ok: true, message: "Anúncio vinculado." };
    }
    await logActivity({ actorId: session.user.id, entityType: "MarketplaceListing", entityId: id, action: "updated", companyId });
    return { ok: true, message: "Anúncio atualizado." };
  });
}

export async function deleteListingAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const id = str(fd, "id");
    const res = await prisma.marketplaceListing.deleteMany({ where: { id: id ?? "", companyId } });
    if (res.count !== 1) throw new Error("Anúncio não encontrado.");
    await logActivity({ actorId: session.user.id, entityType: "MarketplaceListing", entityId: id!, action: "deleted", companyId });
  });
}

export async function syncListingAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const r = await syncListingStock(companyId, str(fd, "id") ?? "");
    if (!r.ok) throw new Error(r.error);
    return { ok: true, message: `Estoque enviado: ${r.available} disponível.` };
  });
}

export async function syncAllListingsAction(): Promise<ActionResult> {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const listings = await prisma.marketplaceListing.findMany({ where: { companyId, channel: "MERCADO_LIVRE" }, select: { id: true } });
    let ok = 0;
    let fail = 0;
    let lastError = "";
    for (const l of listings) {
      const r = await syncListingStock(companyId, l.id);
      if (r.ok) ok++;
      else {
        fail++;
        lastError = r.error;
      }
    }
    if (fail > 0 && ok === 0) throw new Error(`Nenhum anúncio sincronizado. ${lastError}`);
    return { ok: true, message: `${ok} sincronizado(s), ${fail} com erro.` };
  });
}

/** Homologação: grava um evento com um pedido ML sintético e o processa
 * pelo mesmo caminho das notificações reais. Repetir o mesmo número de
 * pedido não cria outro pedido (dedupe por canal + id externo). */
export async function simulateOrderAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const listingId = str(fd, "listingId");
    const quantity = int(fd, "quantity") ?? 0;
    const unitPrice = num(fd, "unitPrice");
    const nickname = str(fd, "nickname") ?? "COMPRADOR_TESTE";
    const externalId = str(fd, "externalId") ?? `SIM-${Date.now()}`;
    if (quantity < 1) throw new Error("Quantidade deve ser 1 ou mais.");
    const listing = await prisma.marketplaceListing.findFirst({ where: { id: listingId ?? "", companyId } });
    if (!listing) throw new Error("Selecione um anúncio desta empresa.");
    const price = unitPrice ?? 0;
    if (price <= 0) throw new Error("Informe o preço unitário do anúncio.");
    const order = {
      id: externalId,
      status: "paid",
      date_created: new Date().toISOString(),
      total_amount: Math.round(price * quantity * 100) / 100,
      buyer: { id: `sim-${nickname.toLowerCase()}`, nickname },
      order_items: [{ item: { id: listing.externalId, title: listing.title }, quantity, unit_price: price }],
      shipping: { id: null },
    };
    const { event } = await recordEvent({
      companyId,
      provider: ML_PROVIDER,
      operation: ML_OPERATIONS.simulatedOrder,
      externalId,
      idempotencyKey: `ml:sim:${externalId}:${str(fd, "requestKey") ?? Date.now()}`,
      payload: { order, simulatedBy: session.user.id },
    });
    const done = await processEvent(event.id);
    if (done.status === "ERRO") throw new Error(`Evento registrado com erro: ${done.lastError}`);
    const created = await prisma.salesOrder.findFirst({
      where: { companyId, channel: "MERCADO_LIVRE", externalId },
      select: { number: true, createdAt: true },
    });
    const isNew = created && created.createdAt >= event.createdAt;
    return {
      ok: true,
      message: isNew
        ? `Pedido ${created.number} importado do ML ${externalId}.`
        : `Pedido ML ${externalId} já existia (pedido ${created?.number ?? "-"}): nada duplicado.`,
    };
  });
}

export async function reprocessAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("mercadolivre");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const ev = await reprocessEvent(session, companyId, str(fd, "id") ?? "");
    if (ev.status === "ERRO") throw new Error(`Ainda com erro: ${ev.lastError}`);
    return { ok: true, message: "Evento reprocessado." };
  });
}
