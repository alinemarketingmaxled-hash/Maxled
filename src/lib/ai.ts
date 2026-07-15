import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPermission, type Module } from "@/lib/permissions";
import { getRevenueByMonth } from "@/lib/analytics";
import type { Prisma } from "@/generated/prisma/client";

const MODEL = "claude-opus-4-8";

let cachedClient: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

function dealScopeWhere(session: Session, mod: Module = "ia"): Prisma.DealWhereInput {
  const { scope } = getPermission(session.user.role, mod);
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

function contactScopeWhere(session: Session, mod: Module = "ia"): Prisma.ContactWhereInput {
  const { scope } = getPermission(session.user.role, mod);
  if (scope === "own") return { ownerId: session.user.id };
  return {};
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) throw new Error("A IA não retornou uma resposta em texto.");
  return block.text.trim();
}

function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Não foi possível interpretar a resposta da IA.");
  return JSON.parse(match[0]) as T;
}

export async function listOpenDealsBrief(session: Session) {
  const deals = await prisma.deal.findMany({
    where: { ...dealScopeWhere(session), deletedAt: null, stage: { isWon: false } },
    include: {
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      stage: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return deals.map((d) => ({
    id: d.id,
    label: `${d.name} — ${d.contact.accountName || `${d.contact.firstName} ${d.contact.lastName}`} (${d.stage.name})`,
  }));
}

export type SalesInsights = {
  forecast: { value: number; confidence: "baixa" | "média" | "alta"; reasoning: string };
  alerts: Array<{
    dealId: string;
    dealName: string;
    contactName: string;
    value: number;
    priority: "alta" | "média" | "baixa";
    reason: string;
  }>;
  crossSell: Array<{ contactId: string; contactName: string; reasoning: string }>;
  tip: string;
  generatedAt: string;
};

/**
 * Forecasting + opportunity alerts + cross-sell (spec §3.6) grounded strictly
 * in real pipeline/revenue data — Claude only ranks and explains ids we
 * already fetched, it never invents deals, contacts or numbers.
 */
export async function getSalesInsights(session: Session): Promise<SalesInsights> {
  const [openDeals, contactsWithWonDeals, revenueHistory] = await Promise.all([
    prisma.deal.findMany({
      where: { ...dealScopeWhere(session), deletedAt: null, stage: { isWon: false } },
      include: {
        contact: { select: { firstName: true, lastName: true, accountName: true } },
        stage: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 40,
    }),
    prisma.contact
      .findMany({
        where: { ...contactScopeWhere(session), deletedAt: null },
        include: {
          deals: {
            where: { deletedAt: null, stage: { isWon: true } },
            select: { value: true, updatedAt: true },
          },
        },
      })
      .then((contacts) => contacts.filter((c) => c.deals.length > 0)),
    getRevenueByMonth(session, 6),
  ]);

  if (openDeals.length === 0 && contactsWithWonDeals.length === 0) {
    return {
      forecast: {
        value: 0,
        confidence: "baixa",
        reasoning: "Ainda não há negócios suficientes no CRM para calcular uma previsão.",
      },
      alerts: [],
      crossSell: [],
      tip: "Cadastre contatos em Vendas e crie negócios em Negócios para a IA começar a gerar insights reais.",
      generatedAt: new Date().toISOString(),
    };
  }

  const dealsPayload = openDeals.map((d) => ({
    id: d.id,
    name: d.name,
    value: Number(d.value),
    stage: d.stage.name,
    contact: d.contact.accountName || `${d.contact.firstName} ${d.contact.lastName}`,
    daysSinceUpdate: daysSince(d.updatedAt),
  }));

  const crossSellPayload = contactsWithWonDeals.map((c) => ({
    id: c.id,
    name: c.accountName || `${c.firstName} ${c.lastName}`,
    wonDeals: c.deals.length,
    totalValue: c.deals.reduce((s, d) => s + Number(d.value), 0),
    lastWonDaysAgo: Math.min(...c.deals.map((d) => daysSince(d.updatedAt))),
  }));

  const prompt = `Você é um analista de vendas para uma distribuidora B2B que usa o CRM Maxled.
Analise SOMENTE os dados reais abaixo. Nunca invente negócios, clientes ou números que não estejam listados.

Receita mensal dos últimos 6 meses (apenas negócios ganhos), em reais: ${JSON.stringify(revenueHistory)}

Negócios em aberto (ainda não ganhos): ${JSON.stringify(dealsPayload)}

Clientes com pelo menos um negócio ganho (candidatos a cross-sell/upsell): ${JSON.stringify(crossSellPayload)}

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON), neste formato exato:
{
  "forecast": { "value": number, "confidence": "baixa"|"média"|"alta", "reasoning": "string curta em português citando os números usados no raciocínio" },
  "alerts": [ { "dealId": "id exato de um negócio da lista acima", "priority": "alta"|"média"|"baixa", "reason": "string curta explicando por que esse negócio precisa de atenção" } ],
  "crossSell": [ { "contactId": "id exato de um cliente da lista acima", "reasoning": "string curta explicando a sugestão" } ],
  "tip": "uma dica estratégica curta e prática para o vendedor, baseada nos dados acima"
}
Limite "alerts" aos 5 negócios mais críticos (priorize os parados há mais tempo e de maior valor) e "crossSell" às 3 melhores oportunidades. Se não houver dados suficientes para uma seção, retorne uma lista vazia para ela.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: prompt }],
  });

  const parsed = extractJson<{
    forecast: SalesInsights["forecast"];
    alerts: Array<{ dealId: string; priority: "alta" | "média" | "baixa"; reason: string }>;
    crossSell: Array<{ contactId: string; reasoning: string }>;
    tip: string;
  }>(extractText(response));

  const dealById = new Map(dealsPayload.map((d) => [d.id, d]));
  const contactById = new Map(crossSellPayload.map((c) => [c.id, c]));

  return {
    forecast: parsed.forecast,
    alerts: parsed.alerts
      .filter((a) => dealById.has(a.dealId))
      .map((a) => {
        const d = dealById.get(a.dealId)!;
        return {
          dealId: a.dealId,
          dealName: d.name,
          contactName: d.contact,
          value: d.value,
          priority: a.priority,
          reason: a.reason,
        };
      }),
    crossSell: parsed.crossSell
      .filter((c) => contactById.has(c.contactId))
      .map((c) => ({
        contactId: c.contactId,
        contactName: contactById.get(c.contactId)!.name,
        reasoning: c.reasoning,
      })),
    tip: parsed.tip,
    generatedAt: new Date().toISOString(),
  };
}

export type DealAssistMode = "tips" | "writing";

/**
 * Writing assist + strategic tips per deal (spec §3.6), grounded in that
 * deal's real stage/value/notes — the two capabilities Claude can already
 * do well from data that exists today.
 */
export async function getDealAssist(
  session: Session,
  dealId: string,
  mode: DealAssistMode,
  context?: string,
): Promise<string> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, deletedAt: null, ...dealScopeWhere(session) },
    include: {
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      stage: { select: { name: true } },
      notes: { orderBy: { createdAt: "desc" }, take: 5, select: { body: true } },
    },
  });
  if (!deal) throw new Error("Negócio não encontrado ou sem permissão.");

  const dealSummary = {
    name: deal.name,
    value: Number(deal.value),
    stage: deal.stage.name,
    contact: deal.contact.accountName || `${deal.contact.firstName} ${deal.contact.lastName}`,
    daysSinceUpdate: daysSince(deal.updatedAt),
    recentNotes: deal.notes.map((n) => n.body).filter(Boolean),
  };

  const prompt =
    mode === "tips"
      ? `Você é um coach de vendas para um vendedor de uma distribuidora B2B. Com base SOMENTE nestes dados reais do negócio, dê de 2 a 4 dicas estratégicas curtas e práticas em português para avançar esse negócio. Não invente informações fora do que está aqui.

Negócio: ${JSON.stringify(dealSummary)}

Responda em texto corrido, sem JSON e sem markdown, direto ao ponto.`
      : `Você é um assistente de redação de vendas B2B. Escreva um rascunho de mensagem (WhatsApp ou e-mail, tom profissional e cordial, em português) para o cliente do negócio abaixo, considerando o contexto adicional informado pelo vendedor.

Negócio: ${JSON.stringify(dealSummary)}

Contexto do vendedor: ${context?.trim() || "(nenhum contexto adicional)"}

Responda apenas com o texto da mensagem, pronto para copiar e enviar — sem JSON e sem explicações extras.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
  });

  return extractText(response);
}
