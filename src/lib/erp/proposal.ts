import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { encryptSecret, decryptSecret } from "@/lib/erp/crypto";
import { addDays } from "@/lib/erp/money";
import {
  addOrderEvent,
  friendlyOrderError,
  loadOrderForTransitionById,
  OrderError,
  orderScopeWhere,
  submitLoadedOrder,
} from "@/lib/erp/orders";

/** Sem data de validade na cotação, o link vale este número de dias a
 * partir do envio. */
export const PROPOSAL_DEFAULT_DAYS = 15;

const hashToken = (token: string) => createHash("sha256").update(`maxled-proposal:${token}`).digest("hex");

export function proposalExpiresAt(order: { validUntil: Date | null; proposalSentAt: Date | null }) {
  if (order.validUntil) return order.validUntil;
  return order.proposalSentAt ? addDays(order.proposalSentAt, PROPOSAL_DEFAULT_DAYS) : null;
}

function isExpired(order: { validUntil: Date | null; proposalSentAt: Date | null }, now = new Date()) {
  const exp = proposalExpiresAt(order);
  // A validade é um dia civil: vale até o fim dele.
  return exp ? now.getTime() > exp.getTime() + 12 * 3600 * 1000 : false;
}

/** Gera (ou troca) o link público da proposta. O link anterior deixa de
 * funcionar na hora. */
export async function createProposalLink(session: Session, companyId: string, orderId: string) {
  if (!canEdit(session.user.role, "pedidos")) throw new OrderError("Sem permissão.");
  const order = await prisma.salesOrder.findFirst({ where: { id: orderId, ...orderScopeWhere(session, companyId) } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  if (order.status !== "COTACAO") throw new OrderError("Só cotações podem ser enviadas como proposta para aprovação.");
  const token = randomBytes(24).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: order.id },
      data: {
        proposalTokenHash: hashToken(token),
        proposalTokenEnc: encryptSecret(token),
        proposalSentAt: new Date(),
        proposalViewedAt: null,
      },
    });
    await addOrderEvent(
      tx,
      order.id,
      { id: session.user.id, name: session.user.name },
      "proposal_link",
      order.proposalTokenHash ? "Novo link de proposta gerado; o anterior foi desativado." : "Link de proposta gerado para o cliente.",
    );
  });
  return token;
}

/** Token atual para reexibir o link ao vendedor (null se nunca gerado ou
 * se a chave de cifra mudou). */
export function currentProposalToken(order: { proposalTokenEnc: string | null }) {
  if (!order.proposalTokenEnc) return null;
  try {
    return decryptSecret(order.proposalTokenEnc);
  } catch {
    return null;
  }
}

/** Dados que o cliente pode ver: nada de custo, margem ou observação
 * interna. */
const publicSelect = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  validUntil: true,
  proposalSentAt: true,
  proposalViewedAt: true,
  proposalAcceptedAt: true,
  proposalAcceptedBy: true,
  paymentMethod: true,
  installments: true,
  firstDueDays: true,
  intervalDays: true,
  itemsTotal: true,
  discountTotal: true,
  freight: true,
  otherExpenses: true,
  total: true,
  carrier: true,
  shippingMode: true,
  freightPayer: true,
  shippingAddress: true,
  notes: true,
  company: {
    select: { code: true, name: true, tradeName: true, cnpj: true, street: true, number: true, district: true, city: true, state: true, phone: true, email: true },
  },
  contact: {
    select: { accountName: true, firstName: true, lastName: true, cnpj: true, email: true, phone: true, mobile: true, city: true, state: true },
  },
  seller: { select: { name: true, email: true } },
  items: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      discountPct: true,
      subtotal: true,
      product: { select: { sku: true, name: true, unit: true, ncm: true } },
    },
  },
} as const;

export type PublicProposal = NonNullable<Awaited<ReturnType<typeof findByToken>>>;

async function findByToken(token: string) {
  if (!token || token.length < 20 || token.length > 64) return null;
  return prisma.salesOrder.findUnique({ where: { proposalTokenHash: hashToken(token) }, select: publicSelect });
}

/** Robôs de pré-visualização (WhatsApp, e-mail, redes) abrem o link sozinhos
 * para montar a prévia; isso não conta como o cliente ter aberto. */
export function isLinkPreviewBot(userAgent: string | null) {
  return !!userAgent && /whatsapp|facebookexternalhit|facebot|telegrambot|slackbot|twitterbot|linkedinbot|discordbot|skypeuripreview|googlebot|bingbot|bot\b|crawler|spider|preview/i.test(userAgent);
}

/** Abre a proposta pelo link. Registra a primeira visualização feita por
 * uma pessoa (`markViewed` false para robôs de pré-visualização). */
export async function viewProposal(token: string, markViewed = true) {
  const order = await findByToken(token);
  if (!order) return null;
  if (markViewed && !order.proposalViewedAt) {
    const updated = await prisma.salesOrder.updateMany({
      where: { id: order.id, proposalViewedAt: null },
      data: { proposalViewedAt: new Date() },
    });
    if (updated.count > 0) {
      await prisma.orderEvent.create({
        data: { orderId: order.id, userId: null, userName: "Cliente (link)", type: "proposal_viewed", message: "O cliente abriu a proposta." },
      });
    }
  }
  return { order, expired: isExpired(order), expiresAt: proposalExpiresAt(order) };
}

/** O cliente aprova a proposta: registra quem aprovou e envia o pedido
 * pelas mesmas regras do vendedor (aprovação automática dentro dos
 * limites, senão fila da gerência). Repetir o envio não duplica nada. */
export async function acceptProposal(token: string, acceptedBy: string) {
  const name = acceptedBy.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 120) throw new OrderError("Informe seu nome completo para aprovar.");
  const found = await findByToken(token);
  if (!found) throw new OrderError("Link inválido ou substituído por um novo. Peça o link atualizado ao vendedor.");
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await loadOrderForTransitionById(tx, found.id);
      if (order.proposalAcceptedAt) return { already: true, status: order.status };
      if (order.status !== "COTACAO") throw new OrderError("Esta proposta não está mais disponível para aprovação.");
      if (isExpired(order)) throw new OrderError("A validade desta proposta terminou. Peça uma proposta atualizada ao vendedor.");
      const claimed = await tx.salesOrder.updateMany({
        where: { id: order.id, proposalAcceptedAt: null, status: "COTACAO" },
        data: { proposalAcceptedAt: new Date(), proposalAcceptedBy: name },
      });
      if (claimed.count === 0) return { already: true, status: order.status };
      const who = `Cliente: ${name}`;
      await tx.orderEvent.create({ data: { orderId: order.id, userId: null, userName: who, type: "proposal_accepted", message: `Proposta aprovada pelo cliente (${name}) pelo link.` } });
      const res = await submitLoadedOrder(tx, order, { auditUserId: order.sellerId, eventActor: null, eventName: who, via: "proposal_link" });
      return { already: false, status: res.status };
    });
  } catch (e) {
    friendlyOrderError(e);
  }
}
