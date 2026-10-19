import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/erp/crypto";
import { addOrderEvent, nextOrderNumber, reserveOrderStock } from "@/lib/erp/orders";
import { availabilityFor } from "@/lib/erp/stock";
import { D, lineSubtotal, round2 } from "@/lib/erp/money";

export const ML_PROVIDER = "MERCADO_LIVRE";
const API = "https://api.mercadolibre.com";
const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";

export class MlError extends Error {}

/** Segredos (cifrados em IntegrationCredential.dataEnc). */
export type MlSecrets = {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  /** epoch ms */
  expiresAt?: number;
  userId?: string;
};

/** Dados não secretos (IntegrationCredential.meta). */
export type MlMeta = {
  sellerUserId?: string;
  defaultSellerId?: string;
  redirectUri?: string;
  connectedAt?: string;
};

export async function getMlCredential(companyId: string) {
  const row = await prisma.integrationCredential.findUnique({
    where: { companyId_provider: { companyId, provider: ML_PROVIDER } },
  });
  if (!row) return null;
  let secrets: MlSecrets = {};
  try {
    secrets = JSON.parse(decryptSecret(row.dataEnc)) as MlSecrets;
  } catch {
    secrets = {};
  }
  return { secrets, meta: (row.meta ?? {}) as MlMeta, updatedAt: row.updatedAt };
}

async function saveMlCredential(companyId: string, secrets: MlSecrets, meta: MlMeta) {
  const dataEnc = encryptSecret(JSON.stringify(secrets));
  await prisma.integrationCredential.upsert({
    where: { companyId_provider: { companyId, provider: ML_PROVIDER } },
    create: { companyId, provider: ML_PROVIDER, dataEnc, meta },
    update: { dataEnc, meta },
  });
}

/** Salva a configuração do app ML. Segredo em branco mantém o atual; os
 * tokens obtidos na conexão nunca são apagados por esta tela. */
export async function saveMlConfig(
  companyId: string,
  input: { clientId: string; clientSecret: string | null; redirectUri: string; defaultSellerId: string | null },
) {
  const current = await getMlCredential(companyId);
  const secrets: MlSecrets = { ...(current?.secrets ?? {}), clientId: input.clientId };
  if (input.clientSecret) secrets.clientSecret = input.clientSecret;
  const meta: MlMeta = {
    ...(current?.meta ?? {}),
    redirectUri: input.redirectUri,
    defaultSellerId: input.defaultSellerId ?? undefined,
  };
  await saveMlCredential(companyId, secrets, meta);
}

/** Resumo seguro para exibir na tela: nunca devolve segredos. */
export async function getMlStatus(companyId: string) {
  const cred = await getMlCredential(companyId);
  const s = cred?.secrets ?? {};
  const last4 = (v?: string) => (v ? `final ${v.slice(-4)}` : null);
  return {
    configured: Boolean(s.clientId && s.clientSecret),
    clientIdHint: last4(s.clientId),
    clientSecretHint: last4(s.clientSecret),
    connected: Boolean(s.accessToken && s.refreshToken),
    tokenExpiresAt: s.expiresAt ? new Date(s.expiresAt) : null,
    sellerUserId: cred?.meta.sellerUserId ?? null,
    defaultSellerId: cred?.meta.defaultSellerId ?? null,
    redirectUri: cred?.meta.redirectUri ?? null,
    connectedAt: cred?.meta.connectedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// OAuth: o state é assinado (HMAC com AUTH_SECRET) e amarra empresa, usuário
// e validade, para o callback não aceitar um code gerado para outra empresa.
// ---------------------------------------------------------------------------

function stateKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new MlError("AUTH_SECRET não configurado.");
  return `maxled-ml-state:${secret}`;
}

export function signState(companyId: string, userId: string) {
  const body = Buffer.from(JSON.stringify({ c: companyId, u: userId, exp: Date.now() + 15 * 60_000 })).toString("base64url");
  const sig = createHmac("sha256", stateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): { companyId: string; userId: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateKey()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { c: string; u: string; exp: number };
    if (!data.c || !data.u || Date.now() > data.exp) return null;
    return { companyId: data.c, userId: data.u };
  } catch {
    return null;
  }
}

export async function buildAuthorizeUrl(companyId: string, userId: string) {
  const cred = await getMlCredential(companyId);
  if (!cred?.secrets.clientId || !cred.meta.redirectUri) {
    throw new MlError("Configure o Client ID e a URL de retorno antes de conectar.");
  }
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cred.secrets.clientId);
  url.searchParams.set("redirect_uri", cred.meta.redirectUri);
  url.searchParams.set("state", signState(companyId, userId));
  return url.toString();
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; user_id: number | string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new MlError(`Falha de comunicação com o Mercado Livre: ${e instanceof Error ? e.message : "rede indisponível"}.`);
  }
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { message?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new MlError(`Mercado Livre recusou a autenticação: ${json.message || json.error || res.status}.`);
  }
  return json as TokenResponse;
}

export async function exchangeCode(companyId: string, code: string) {
  const cred = await getMlCredential(companyId);
  if (!cred?.secrets.clientId || !cred.secrets.clientSecret || !cred.meta.redirectUri) {
    throw new MlError("Configuração do aplicativo Mercado Livre incompleta.");
  }
  const t = await tokenRequest({
    grant_type: "authorization_code",
    client_id: cred.secrets.clientId,
    client_secret: cred.secrets.clientSecret,
    code,
    redirect_uri: cred.meta.redirectUri,
  });
  await saveMlCredential(
    companyId,
    {
      ...cred.secrets,
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      userId: String(t.user_id),
    },
    { ...cred.meta, sellerUserId: String(t.user_id), connectedAt: new Date().toISOString() },
  );
}

/** Token válido para chamar a API; renova com o refresh_token quando falta
 * menos de 5 minutos para expirar. */
export async function getAccessToken(companyId: string) {
  const cred = await getMlCredential(companyId);
  if (!cred?.secrets.accessToken || !cred.secrets.refreshToken) {
    throw new MlError("Conta Mercado Livre não conectada para esta empresa.");
  }
  if (cred.secrets.expiresAt && cred.secrets.expiresAt - Date.now() > 5 * 60_000) return cred.secrets.accessToken;
  if (!cred.secrets.clientId || !cred.secrets.clientSecret) throw new MlError("Client ID/Secret ausentes para renovar o token.");
  const t = await tokenRequest({
    grant_type: "refresh_token",
    client_id: cred.secrets.clientId,
    client_secret: cred.secrets.clientSecret,
    refresh_token: cred.secrets.refreshToken,
  });
  await saveMlCredential(
    companyId,
    { ...cred.secrets, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 },
    cred.meta,
  );
  return t.access_token;
}

async function mlFetch(companyId: string, path: string, init: RequestInit = {}) {
  const token = await getAccessToken(companyId);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new MlError(`Falha de comunicação com o Mercado Livre: ${e instanceof Error ? e.message : "rede indisponível"}.`);
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new MlError(`Mercado Livre respondeu ${res.status}: ${String(json.message ?? json.error ?? "erro")}.`);
  return json;
}

export async function fetchMlOrder(companyId: string, orderId: string) {
  return (await mlFetch(companyId, `/orders/${encodeURIComponent(orderId)}`)) as unknown as MlOrder;
}

// ---------------------------------------------------------------------------
// Importação de pedidos.
// ---------------------------------------------------------------------------

export type MlOrder = {
  id: string | number;
  status: string;
  date_created?: string;
  total_amount?: number;
  buyer?: { id?: string | number; nickname?: string; first_name?: string; last_name?: string };
  order_items: { item: { id: string; title?: string }; quantity: number; unit_price: number }[];
  shipping?: { id?: string | number | null } | null;
};

export type MlOrderOutcome =
  | { outcome: "created"; orderId: string; message: string }
  | { outcome: "duplicate"; orderId: string; message: string }
  | { outcome: "ignored"; orderId?: string; message: string };

async function resolveSellerId(companyId: string) {
  const cred = await getMlCredential(companyId);
  const wanted = cred?.meta.defaultSellerId;
  if (wanted) {
    const u = await prisma.user.findFirst({ where: { id: wanted, deletedAt: null }, select: { id: true } });
    if (u) return u.id;
  }
  const mediator = await prisma.user.findFirst({ where: { role: "MEDIATOR", deletedAt: null }, orderBy: { createdAt: "asc" } });
  if (!mediator) throw new MlError("Defina o vendedor responsável pelos pedidos Mercado Livre na configuração.");
  return mediator.id;
}

/**
 * Importa um pedido ML como SalesOrder aprovado com estoque reservado. A
 * unique (channel, externalId) é a deduplicação real: notificações repetidas
 * ou reprocessamentos devolvem o pedido já existente sem reservar de novo.
 */
export async function processMlOrder(companyId: string, ml: MlOrder): Promise<MlOrderOutcome> {
  const externalId = String(ml.id);
  const existing = await prisma.salesOrder.findUnique({
    where: { channel_externalId: { channel: "MERCADO_LIVRE", externalId } },
    select: { id: true, companyId: true, number: true, status: true },
  });
  if (existing && existing.companyId !== companyId) {
    throw new MlError(`Pedido ML ${externalId} já pertence a outra empresa.`);
  }

  if (ml.status !== "paid") {
    if (existing && ml.status === "cancelled" && existing.status !== "CANCELADO") {
      await addOrderEvent(
        prisma,
        existing.id,
        null,
        "ml_cancelled",
        "Mercado Livre informou cancelamento deste pedido. Cancele manualmente (liberação de estoque e nota) após conferir.",
      );
      return { outcome: "ignored", orderId: existing.id, message: "Pedido cancelado no Mercado Livre: requer tratamento manual." };
    }
    return { outcome: "ignored", orderId: existing?.id, message: `Status "${ml.status}" não é importado (só pedidos pagos).` };
  }
  if (existing) {
    return { outcome: "duplicate", orderId: existing.id, message: `Pedido ML ${externalId} já importado (pedido ${existing.number}).` };
  }

  if (!ml.order_items?.length) throw new MlError("Pedido ML sem itens.");
  const listings = await prisma.marketplaceListing.findMany({
    where: { companyId, channel: "MERCADO_LIVRE", externalId: { in: ml.order_items.map((i) => i.item.id) }, active: true },
    include: { product: { select: { id: true, sku: true, cost: true, minPrice: true, active: true, deletedAt: true } } },
  });
  const byExt = new Map(listings.map((l) => [l.externalId, l]));
  const missing = ml.order_items.filter((i) => !byExt.has(i.item.id)).map((i) => i.item.id);
  if (missing.length > 0) {
    throw new MlError(`Anúncio(s) sem vínculo com produto: ${missing.join(", ")}. Cadastre o anúncio e reprocesse.`);
  }

  const rows = ml.order_items.map((line, position) => {
    const listing = byExt.get(line.item.id)!;
    if (!listing.product.active || listing.product.deletedAt) throw new MlError(`Produto ${listing.product.sku} inativo.`);
    // Um anúncio "kit 25" apontando para o SKU unitário vira 25 × quantidade;
    // apontando para um produto kit (unitsPerSale 1) explode na reserva.
    const quantity = line.quantity * listing.unitsPerSale;
    const lineTotal = round2(D(line.unit_price).mul(line.quantity));
    const unitPrice = round2(lineTotal.div(quantity));
    const subtotal = lineSubtotal(quantity, unitPrice, 0);
    return {
      productId: listing.product.id,
      quantity,
      unitPrice,
      discountPct: D(0),
      subtotal,
      unitCost: listing.product.cost,
      belowMinPrice: listing.product.minPrice !== null && unitPrice.lessThan(listing.product.minPrice),
      position,
      lineTotal,
    };
  });
  const itemsTotal = rows.reduce((s, r) => s.add(r.subtotal), D(0));
  const mlTotal = ml.total_amount !== undefined && ml.total_amount !== null
    ? round2(ml.total_amount)
    : rows.reduce((s, r) => s.add(r.lineTotal), D(0));
  // Diferença de arredondamento (preço por unidade com centavos) fica em
  // desconto/despesa para o total bater exatamente com o Mercado Livre.
  const diff = mlTotal.sub(itemsTotal);
  const discountTotal = diff.lessThan(0) ? diff.neg() : D(0);
  const otherExpenses = diff.greaterThan(0) ? diff : D(0);

  const sellerId = await resolveSellerId(companyId);
  const buyerId = String(ml.buyer?.id ?? ml.buyer?.nickname ?? "desconhecido");
  const nickname = ml.buyer?.nickname || buyerId;
  const marker = `ml-buyer:${buyerId}`;

  try {
    return await prisma.$transaction(
      async (tx) => {
        let contact = await tx.contact.findFirst({
          where: { deletedAt: null, notes: { contains: marker } },
          select: { id: true },
        });
        if (!contact) {
          contact = await tx.contact.create({
            data: {
              ownerId: sellerId,
              firstName: ml.buyer?.first_name || nickname,
              lastName: ml.buyer?.last_name || "",
              accountName: `ML ${nickname}`,
              leadSource: "Mercado Livre",
              crmStatus: "ATIVO",
              notes: marker,
            },
            select: { id: true },
          });
        }
        const number = await nextOrderNumber(tx, companyId);
        const order = await tx.salesOrder.create({
          data: {
            companyId,
            number,
            contactId: contact.id,
            sellerId,
            channel: "MERCADO_LIVRE",
            externalId,
            status: "APROVADO",
            needsApproval: false,
            approvalReason: "Pedido Mercado Livre pago",
            submittedAt: new Date(),
            approvedAt: new Date(),
            paymentMethod: "Mercado Pago",
            installments: 1,
            firstDueDays: 0,
            itemsTotal,
            discountTotal,
            otherExpenses,
            total: mlTotal,
            shippingMode: "Mercado Envios",
            internalNotes: ml.shipping?.id ? `Envio ML ${ml.shipping.id}` : null,
            items: {
              create: rows.map((r) => ({
                productId: r.productId,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                discountPct: r.discountPct,
                subtotal: r.subtotal,
                unitCost: r.unitCost,
                belowMinPrice: r.belowMinPrice,
                position: r.position,
              })),
            },
          },
        });
        await reserveOrderStock(tx, order.id, null);
        await addOrderEvent(tx, order.id, null, "imported", `Importado do Mercado Livre (pedido ML ${externalId}, comprador ${nickname}). Estoque reservado.`);
        return { outcome: "created" as const, orderId: order.id, message: `Pedido ${number} criado a partir do ML ${externalId}.` };
      },
      { timeout: 20000 },
    );
  } catch (e) {
    // Duas notificações simultâneas do mesmo pedido: a segunda perde na
    // unique e devolve o pedido criado pela primeira.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.salesOrder.findUnique({
        where: { channel_externalId: { channel: "MERCADO_LIVRE", externalId } },
        select: { id: true },
      });
      if (again) return { outcome: "duplicate", orderId: again.id, message: `Pedido ML ${externalId} já importado.` };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Estoque → anúncio.
// ---------------------------------------------------------------------------

export async function listingAvailable(companyId: string, listings: { id: string; productId: string; unitsPerSale: number }[]) {
  const avail = await availabilityFor(companyId, [...new Set(listings.map((l) => l.productId))]);
  return new Map(listings.map((l) => [l.id, Math.max(0, Math.floor((avail.get(l.productId) ?? 0) / Math.max(1, l.unitsPerSale)))]));
}

export async function syncListingStock(companyId: string, listingId: string) {
  const listing = await prisma.marketplaceListing.findFirst({ where: { id: listingId, companyId } });
  if (!listing) throw new MlError("Anúncio não encontrado.");
  const available = (await listingAvailable(companyId, [listing])).get(listing.id) ?? 0;
  try {
    await mlFetch(companyId, `/items/${encodeURIComponent(listing.externalId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ available_quantity: listing.active ? available : 0 }),
    });
    await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: { lastStockSyncAt: new Date(), lastSyncError: null },
    });
    return { ok: true as const, available };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha na sincronização.";
    await prisma.marketplaceListing.update({ where: { id: listing.id }, data: { lastSyncError: message } });
    return { ok: false as const, error: message };
  }
}
