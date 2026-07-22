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
      contact: { select: { firstName: true, lastName: true, accountName: true, mobile: true, phone: true } },
      stage: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return deals.map((d) => ({
    id: d.id,
    label: `${d.name} — ${d.contact.accountName || `${d.contact.firstName} ${d.contact.lastName}`} (${d.stage.name})`,
    phone: d.contact.mobile ?? d.contact.phone,
  }));
}

export type SalesInsights = {
  source: "ai" | "heuristic";
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

type DealBrief = {
  id: string;
  name: string;
  value: number;
  stage: string;
  contact: string;
  daysSinceUpdate: number;
};

type CrossSellBrief = {
  id: string;
  name: string;
  wonDeals: number;
  totalValue: number;
  lastWonDaysAgo: number;
};

async function fetchInsightsData(session: Session) {
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

  const dealsPayload: DealBrief[] = openDeals.map((d) => ({
    id: d.id,
    name: d.name,
    value: Number(d.value),
    stage: d.stage.name,
    contact: d.contact.accountName || `${d.contact.firstName} ${d.contact.lastName}`,
    daysSinceUpdate: daysSince(d.updatedAt),
  }));

  const crossSellPayload: CrossSellBrief[] = contactsWithWonDeals.map((c) => ({
    id: c.id,
    name: c.accountName || `${c.firstName} ${c.lastName}`,
    wonDeals: c.deals.length,
    totalValue: c.deals.reduce((s, d) => s + Number(d.value), 0),
    lastWonDaysAgo: Math.min(...c.deals.map((d) => daysSince(d.updatedAt))),
  }));

  return { dealsPayload, crossSellPayload, revenueHistory };
}

/**
 * Zero-cost fallback used whenever the real Claude call isn't available (no
 * ANTHROPIC_API_KEY, or the account is out of credit) — plain arithmetic
 * over the same real data, never invented numbers. Always labelled
 * source:"heuristic" so the UI can be honest about it not being real AI.
 */
function heuristicSalesInsights(data: Awaited<ReturnType<typeof fetchInsightsData>>): SalesInsights {
  const { dealsPayload, crossSellPayload, revenueHistory } = data;

  const recentMonths = revenueHistory.slice(-3);
  const nonZero = recentMonths.filter((m) => m.value > 0);
  const avg = nonZero.length > 0 ? nonZero.reduce((s, m) => s + m.value, 0) / nonZero.length : 0;
  const monthsLabel = nonZero.map((m) => m.label).join(", ") || "sem faturamento recente";

  const alerts = [...dealsPayload]
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 5)
    .map((d) => ({
      dealId: d.id,
      dealName: d.name,
      contactName: d.contact,
      value: d.value,
      priority: (d.daysSinceUpdate > 30 ? "alta" : d.daysSinceUpdate > 14 ? "média" : "baixa") as
        | "alta"
        | "média"
        | "baixa",
      reason: `Sem atualização há ${d.daysSinceUpdate} dia(s).`,
    }));

  const crossSell = [...crossSellPayload]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 3)
    .map((c) => ({
      contactId: c.id,
      contactName: c.name,
      reasoning: `Já fechou ${c.wonDeals} negócio(s) totalizando ${c.totalValue.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} — bom candidato a um novo contato.`,
    }));

  const staleCount = dealsPayload.filter((d) => d.daysSinceUpdate > 14).length;
  const tip =
    staleCount > 0
      ? `Você tem ${staleCount} negócio(s) parados há mais de 14 dias — priorize retomar contato com eles esta semana.`
      : "Seus negócios em aberto estão com contato em dia — continue o ritmo de acompanhamento.";

  return {
    source: "heuristic",
    forecast: {
      value: Math.round(avg),
      confidence: "baixa",
      reasoning:
        nonZero.length > 0
          ? `Média simples do faturamento dos últimos meses com vendas (${monthsLabel}). Cálculo automático, sem IA.`
          : "Sem faturamento suficiente nos últimos meses para calcular uma média. Cálculo automático, sem IA.",
    },
    alerts,
    crossSell,
    tip,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Forecasting + opportunity alerts + cross-sell (spec §3.6) grounded strictly
 * in real pipeline/revenue data — Claude only ranks and explains ids we
 * already fetched, it never invents deals, contacts or numbers.
 *
 * Falls back to heuristicSalesInsights() whenever the API key is missing or
 * the Claude call fails (e.g. insufficient credit) — the seller always gets
 * something useful, and the result is always labelled with its real source.
 */
export async function getSalesInsights(session: Session): Promise<SalesInsights> {
  const data = await fetchInsightsData(session);
  const { dealsPayload, crossSellPayload, revenueHistory } = data;

  if (dealsPayload.length === 0 && crossSellPayload.length === 0) {
    return {
      source: "heuristic",
      forecast: {
        value: 0,
        confidence: "baixa",
        reasoning: "Ainda não há negócios suficientes no CRM para calcular uma previsão.",
      },
      alerts: [],
      crossSell: [],
      tip: "Cadastre contatos em Vendas e crie negócios em Negócios para começar a gerar insights.",
      generatedAt: new Date().toISOString(),
    };
  }

  if (isAiConfigured()) {
    try {
      return await getSalesInsightsFromAi(dealsPayload, crossSellPayload, revenueHistory);
    } catch {
      // Chave configurada mas a chamada falhou (ex: sem crédito) — cai no cálculo automático.
    }
  }

  return heuristicSalesInsights(data);
}

async function getSalesInsightsFromAi(
  dealsPayload: DealBrief[],
  crossSellPayload: CrossSellBrief[],
  revenueHistory: Awaited<ReturnType<typeof getRevenueByMonth>>,
): Promise<SalesInsights> {
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
    source: "ai",
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

export type DealAssistResult = { text: string; source: "ai" | "heuristic" };

type DealSummary = {
  name: string;
  value: number;
  stage: string;
  contact: string;
  contactFirstName: string;
  daysSinceUpdate: number;
  recentNotes: string[];
};

/** Zero-cost fallback for getDealAssist — deterministic templates over the
 * same real deal data, never invented. Always labelled source:"heuristic". */
function heuristicDealAssist(deal: DealSummary, mode: DealAssistMode, context?: string): string {
  if (mode === "tips") {
    const tips: string[] = [];
    if (deal.daysSinceUpdate > 14) {
      tips.push(`Esse negócio está sem atualização há ${deal.daysSinceUpdate} dias — vale retomar contato esta semana.`);
    } else {
      tips.push(`Atualizado recentemente (há ${deal.daysSinceUpdate} dia(s)) — bom momento para dar o próximo passo.`);
    }
    if (deal.recentNotes.length === 0) {
      tips.push("Ainda não há notas registradas neste negócio — registre o histórico de conversas para acompanhar melhor.");
    }
    tips.push(`Confirme com "${deal.contact}" os próximos passos para avançar da etapa "${deal.stage}".`);
    if (deal.value > 0) {
      tips.push(`Negócio de valor considerável — priorize o acompanhamento próximo até o fechamento.`);
    }
    return tips.slice(0, 4).join("\n");
  }

  const greeting = deal.contactFirstName ? `Olá, ${deal.contactFirstName}! Tudo bem?` : "Olá! Tudo bem?";
  const body = context?.trim()
    ? context.trim()
    : `Estou entrando em contato sobre o negócio "${deal.name}" (etapa atual: ${deal.stage}). Gostaria de saber se você tem alguma dúvida ou se posso ajudar em algo para seguirmos com a proposta.`;
  return `${greeting}\n\n${body}\n\nFico à disposição!`;
}

/**
 * Writing assist + strategic tips per deal (spec §3.6), grounded in that
 * deal's real stage/value/notes — the two capabilities Claude can already
 * do well from data that exists today.
 *
 * Falls back to heuristicDealAssist() whenever the API key is missing or the
 * Claude call fails (e.g. insufficient credit) — always labelled with its
 * real source so the UI never claims a heuristic answer is real AI.
 */
export async function getDealAssist(
  session: Session,
  dealId: string,
  mode: DealAssistMode,
  context?: string,
): Promise<DealAssistResult> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, deletedAt: null, ...dealScopeWhere(session) },
    include: {
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      stage: { select: { name: true } },
      notes: { orderBy: { createdAt: "desc" }, take: 5, select: { body: true } },
    },
  });
  if (!deal) throw new Error("Negócio não encontrado ou sem permissão.");

  const dealSummary: DealSummary = {
    name: deal.name,
    value: Number(deal.value),
    stage: deal.stage.name,
    contact: deal.contact.accountName || `${deal.contact.firstName} ${deal.contact.lastName}`,
    contactFirstName: deal.contact.firstName,
    daysSinceUpdate: daysSince(deal.updatedAt),
    recentNotes: deal.notes.map((n) => n.body).filter((b): b is string => !!b),
  };

  if (isAiConfigured()) {
    try {
      const text = await getDealAssistFromAi(dealSummary, mode, context);
      return { text, source: "ai" };
    } catch {
      // Chave configurada mas a chamada falhou (ex: sem crédito) — cai no modelo de mensagem automático.
    }
  }

  return { text: heuristicDealAssist(dealSummary, mode, context), source: "heuristic" };
}

async function getDealAssistFromAi(
  dealSummary: DealSummary,
  mode: DealAssistMode,
  context?: string,
): Promise<string> {
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
