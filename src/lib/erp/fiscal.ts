import "server-only";
import { randomInt } from "node:crypto";
import type { Session } from "next-auth";
import type { Company, Contact, FiscalDocStatus, FiscalEnvironment, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { addOrderEvent, reachedStatus } from "@/lib/erp/orders";
import { cancelOpenReceivablesForOrder, createReceivablesForOrder } from "@/lib/erp/finance";

export class FiscalError extends Error {}

export const FISCAL_STATUS_LABELS: Record<FiscalDocStatus, string> = {
  PROCESSANDO: "Processando",
  AUTORIZADA: "Autorizada",
  REJEITADA: "Rejeitada",
  CANCELADA: "Cancelada",
};

// ---------------------------------------------------------------------------
// Provedores. O provedor fiscal atual da MAX LED ainda não foi informado
// (§12): até lá só existe o simulador de homologação, que valida os dados
// obrigatórios como a SEFAZ faria e devolve chave/protocolo/XML marcados
// "SEM VALOR FISCAL". Um provedor real implementa esta mesma interface.
// ---------------------------------------------------------------------------

type EmitPayload = {
  company: Company;
  contact: Contact;
  environment: FiscalEnvironment;
  series: number;
  number: number;
  issuedAt: Date;
  total: Prisma.Decimal;
  freight: Prisma.Decimal;
  discount: Prisma.Decimal;
  items: { sku: string; name: string; ncm: string | null; cest: string | null; origin: number; unit: string; quantity: number; unitPrice: Prisma.Decimal; subtotal: Prisma.Decimal }[];
};

type EmitResult =
  | { status: "AUTORIZADA"; accessKey: string; protocol: string; xml: string }
  | { status: "REJEITADA"; code: string; reason: string };

interface FiscalProvider {
  emit(p: EmitPayload): Promise<EmitResult>;
  cancel(doc: { accessKey: string; protocol: string; reason: string }): Promise<{ protocol: string }>;
}

const UF_CODES: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17", MA: "21", PI: "22", CE: "23",
  RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Dígito verificador módulo 11 da chave de acesso (pesos 2..9). */
export function accessKeyDv(key43: string) {
  let sum = 0;
  let weight = 2;
  for (let i = key43.length - 1; i >= 0; i--) {
    sum += Number(key43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function buildAccessKey(p: EmitPayload) {
  const uf = UF_CODES[(p.company.state ?? "").toUpperCase()];
  const aamm = `${String(p.issuedAt.getFullYear()).slice(2)}${String(p.issuedAt.getMonth() + 1).padStart(2, "0")}`;
  const cNF = String(randomInt(0, 99999999)).padStart(8, "0");
  const key43 = `${uf}${aamm}${digits(p.company.cnpj).padStart(14, "0")}55${String(p.series).padStart(3, "0")}${String(p.number).padStart(9, "0")}1${cNF}`;
  return `${key43}${accessKeyDv(key43)}`;
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const simulator: FiscalProvider = {
  async emit(p) {
    const cnpj = digits(p.company.cnpj);
    if (cnpj.length !== 14) return { status: "REJEITADA", code: "207", reason: "CNPJ do emitente inválido. Complete os dados da empresa em Empresas." };
    if (!UF_CODES[(p.company.state ?? "").toUpperCase()]) return { status: "REJEITADA", code: "226", reason: "UF do emitente inválida." };
    const dest = digits(p.contact.cnpj);
    if (dest.length !== 11 && dest.length !== 14) return { status: "REJEITADA", code: "208", reason: "CPF/CNPJ do destinatário inválido. Corrija o cadastro do cliente." };
    if (!p.contact.city || !p.contact.state || !p.contact.postalCode) {
      return { status: "REJEITADA", code: "898", reason: "Endereço do destinatário incompleto (cidade, UF e CEP)." };
    }
    const badNcm = p.items.find((i) => digits(i.ncm).length !== 8);
    if (badNcm) return { status: "REJEITADA", code: "778", reason: `NCM inexistente/inválido no item ${badNcm.sku}. Corrija o cadastro do produto.` };
    if (p.total.lessThanOrEqualTo(0)) return { status: "REJEITADA", code: "610", reason: "Total da NF-e diferente do somatório dos itens." };

    const accessKey = buildAccessKey(p);
    const protocol = `1${UF_CODES[(p.company.state ?? "").toUpperCase()]}${String(p.issuedAt.getFullYear()).slice(2)}${String(randomInt(0, 999999999999)).padStart(12, "0")}`.slice(0, 15);
    const homolog = p.environment === "HOMOLOGACAO";
    const det = p.items
      .map(
        (i, n) =>
          `<det nItem="${n + 1}"><prod><cProd>${xmlEscape(i.sku)}</cProd><xProd>${xmlEscape(homolog && n === 0 ? "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : i.name)}</xProd><NCM>${digits(i.ncm)}</NCM>${i.cest ? `<CEST>${digits(i.cest)}</CEST>` : ""}<uCom>${xmlEscape(i.unit)}</uCom><qCom>${i.quantity}</qCom><vUnCom>${i.unitPrice.toFixed(2)}</vUnCom><vProd>${i.subtotal.toFixed(2)}</vProd></prod><imposto><ICMS><orig>${i.origin}</orig><!-- tributos calculados pelo provedor fiscal real --></ICMS></imposto></det>`,
      )
      .join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${accessKey}" versao="4.00"><ide><mod>55</mod><serie>${p.series}</serie><nNF>${p.number}</nNF><dhEmi>${p.issuedAt.toISOString()}</dhEmi><tpAmb>${homolog ? 2 : 1}</tpAmb></ide><emit><CNPJ>${cnpj}</CNPJ><xNome>${xmlEscape(p.company.name)}</xNome><IE>${xmlEscape(p.company.stateRegistration ?? "")}</IE><UF>${xmlEscape(p.company.state ?? "")}</UF></emit><dest>${dest.length === 14 ? `<CNPJ>${dest}</CNPJ>` : `<CPF>${dest}</CPF>`}<xNome>${xmlEscape(homolog ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : p.contact.accountName || `${p.contact.firstName} ${p.contact.lastName}`)}</xNome></dest>${det}<total><ICMSTot><vProd>${p.items.reduce((s, i) => s.add(i.subtotal), p.total.mul(0)).toFixed(2)}</vProd><vFrete>${p.freight.toFixed(2)}</vFrete><vDesc>${p.discount.toFixed(2)}</vDesc><vNF>${p.total.toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe><protNFe versao="4.00"><infProt><tpAmb>${homolog ? 2 : 1}</tpAmb><chNFe>${accessKey}</chNFe><nProt>${protocol}</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e (simulador)</xMotivo></infProt></protNFe></nfeProc>`;
    return { status: "AUTORIZADA", accessKey, protocol, xml };
  },
  async cancel() {
    return { protocol: `1${String(randomInt(0, 99999999999999)).padStart(14, "0")}` };
  },
};

function providerFor(company: Company): FiscalProvider {
  if (company.fiscalProvider === "simulador") {
    if (company.fiscalEnvironment !== "HOMOLOGACAO") {
      throw new FiscalError("O simulador só opera em homologação. Configure o provedor fiscal real antes de emitir em produção.");
    }
    return simulator;
  }
  throw new FiscalError(
    `Provedor fiscal "${company.fiscalProvider}" ainda não integrado. Informe os dados do provedor atual (§12) para concluir a integração.`,
  );
}

/** Emite (ou reenvia, após rejeição) a nota do pedido. activeKey garante
 * uma nota ativa por pedido; uma nota já autorizada é devolvida sem nova
 * emissão — clicar duas vezes ou reprocessar é seguro. */
export async function emitForOrder(session: Session, companyId: string, orderId: string) {
  if (!canEdit(session.user.role, "fiscal")) throw new FiscalError("Sem permissão no Fiscal.");
  const actor = { id: session.user.id, name: session.user.name };

  const prepared = await prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findFirst({ where: { id: orderId, companyId }, include: { company: true } });
    if (!order) throw new FiscalError("Pedido não encontrado.");
    if (order.status === "CANCELADO" || !reachedStatus(order.status, "APROVADO")) {
      throw new FiscalError("A nota só pode ser emitida para pedido aprovado.");
    }
    const existing = await tx.fiscalDocument.findUnique({ where: { activeKey: order.id } });
    if (existing?.status === "AUTORIZADA") return { doc: existing, alreadyAuthorized: true };
    if (existing?.status === "PROCESSANDO" && existing.updatedAt > new Date(Date.now() - 2 * 60_000)) {
      throw new FiscalError("Nota já está em processamento. Aguarde e atualize a página.");
    }
    if (existing) {
      const doc = await tx.fiscalDocument.update({
        where: { id: existing.id },
        data: { status: "PROCESSANDO", attempts: { increment: 1 }, totalAmount: order.total },
      });
      return { doc, alreadyAuthorized: false };
    }
    const company = await tx.company.update({
      where: { id: companyId },
      data: { nextFiscalNumber: { increment: 1 } },
      select: { nextFiscalNumber: true },
    });
    const doc = await tx.fiscalDocument.create({
      data: {
        companyId,
        orderId: order.id,
        activeKey: order.id,
        series: order.company.fiscalSeries,
        number: company.nextFiscalNumber - 1,
        environment: order.company.fiscalEnvironment,
        provider: order.company.fiscalProvider,
        totalAmount: order.total,
        attempts: 1,
        createdById: actor.id,
      },
    });
    return { doc, alreadyAuthorized: false };
  });
  if (prepared.alreadyAuthorized) return prepared.doc;

  const doc = prepared.doc;
  const order = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { company: true, contact: true, items: { orderBy: { position: "asc" }, include: { product: true } } },
  });

  let result: EmitResult;
  try {
    result = await providerFor(order.company).emit({
      company: order.company,
      contact: order.contact,
      environment: doc.environment,
      series: doc.series,
      number: doc.number ?? 0,
      issuedAt: new Date(),
      total: order.total,
      freight: order.freight,
      discount: order.discountTotal,
      items: order.items.map((i) => ({
        sku: i.product.sku, name: i.product.name, ncm: i.product.ncm, cest: i.product.cest, origin: i.product.origin,
        unit: i.product.unit, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal,
      })),
    });
  } catch (e) {
    // Falha de comunicação/configuração: fica rejeitada com o motivo e pode
    // ser reenviada sem gerar outra nota.
    result = { status: "REJEITADA", code: "FALHA", reason: e instanceof Error ? e.message : "Falha de comunicação com o provedor." };
  }

  return prisma.$transaction(async (tx) => {
    if (result.status === "AUTORIZADA") {
      const now = new Date();
      const updated = await tx.fiscalDocument.update({
        where: { id: doc.id },
        data: {
          status: "AUTORIZADA", accessKey: result.accessKey, protocol: result.protocol, xml: result.xml,
          authorizedAt: now, rejectionCode: null, rejectionReason: null,
        },
      });
      await createReceivablesForOrder(tx, order.id, doc.id, now);
      await addOrderEvent(tx, order.id, actor, "fiscal_authorized", `NF-e ${doc.number} autorizada (protocolo ${result.protocol}). Contas a receber geradas.`);
      await logActivity({ actorId: actor.id, entityType: "FiscalDocument", entityId: doc.id, action: "emitted", companyId }, tx);
      return updated;
    }
    const updated = await tx.fiscalDocument.update({
      where: { id: doc.id },
      data: { status: "REJEITADA", rejectionCode: result.code, rejectionReason: result.reason },
    });
    await addOrderEvent(tx, order.id, actor, "fiscal_rejected", `NF-e rejeitada (${result.code}): ${result.reason}`);
    return updated;
  });
}

export async function cancelFiscalDocument(session: Session, companyId: string, docId: string, reason: string) {
  if (!canEdit(session.user.role, "fiscal")) throw new FiscalError("Sem permissão no Fiscal.");
  // Mesmo limite da SEFAZ para a justificativa do evento de cancelamento.
  if (reason.trim().length < 15) throw new FiscalError("A justificativa precisa ter ao menos 15 caracteres.");
  const doc = await prisma.fiscalDocument.findFirst({ where: { id: docId, companyId }, include: { order: true, company: true } });
  if (!doc) throw new FiscalError("Nota não encontrada.");
  if (doc.status !== "AUTORIZADA" || !doc.accessKey || !doc.protocol) throw new FiscalError("Só notas autorizadas podem ser canceladas.");
  if (reachedStatus(doc.order.status, "ENVIADO")) throw new FiscalError("Mercadoria já enviada: use nota de devolução.");
  const paid = await prisma.receivable.count({ where: { orderId: doc.orderId, paidAmount: { gt: 0 }, status: { not: "CANCELADO" } } });
  if (paid > 0) throw new FiscalError("Há parcelas com pagamento registrado: estorne no Financeiro antes de cancelar a nota.");

  const { protocol } = await providerFor(doc.company).cancel({ accessKey: doc.accessKey, protocol: doc.protocol, reason });
  const actor = { id: session.user.id, name: session.user.name };
  await prisma.$transaction(async (tx) => {
    await cancelOpenReceivablesForOrder(tx, doc.orderId);
    await tx.fiscalDocument.update({
      where: { id: doc.id },
      data: { status: "CANCELADA", activeKey: null, cancelledAt: new Date(), cancelReason: reason, cancelProtocol: protocol },
    });
    await addOrderEvent(tx, doc.orderId, actor, "fiscal_cancelled", `NF-e ${doc.number} cancelada: ${reason}`);
    await logActivity({ actorId: actor.id, entityType: "FiscalDocument", entityId: doc.id, action: "cancelled", diff: { reason }, companyId }, tx);
  });
}
