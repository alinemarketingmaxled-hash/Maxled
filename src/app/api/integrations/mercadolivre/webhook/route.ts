import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ML_PROVIDER } from "@/lib/erp/mercadolivre";
import { processEvent, recordEvent } from "@/lib/erp/integrations";

/**
 * Notificações do Mercado Livre (topic orders_v2 etc.). Responde 200 na
 * hora (o ML reenvia se demorar) e processa depois da resposta. A chave do
 * evento evita gravar a mesma notificação duas vezes; a deduplicação real
 * do pedido é a unique (channel, externalId) em SalesOrder.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.resource !== "string") {
    return NextResponse.json({ ok: false, error: "payload inválido" }, { status: 400 });
  }
  const topic = String(body.topic ?? "desconhecido");
  const userId = body.user_id !== undefined ? String(body.user_id) : null;

  const cred = userId
    ? await prisma.integrationCredential.findFirst({
        where: { provider: ML_PROVIDER, meta: { path: ["sellerUserId"], equals: userId } },
        select: { companyId: true },
      })
    : null;

  const orderMatch = body.resource.match(/\/orders\/(\d+)/);
  const stamp = typeof body.sent === "string" ? body.sent : new Date().toISOString();
  const { event, created } = await recordEvent({
    companyId: cred?.companyId ?? null,
    provider: ML_PROVIDER,
    operation: topic,
    externalId: orderMatch?.[1] ?? null,
    idempotencyKey: `ml:${topic}:${body.resource}:${stamp}`,
    payload: body as never,
    status: cred ? "PENDENTE" : "IGNORADO",
    lastError: cred ? null : `Nenhuma empresa conectada à conta ML ${userId ?? "?"}.`,
  });

  if (created && cred) {
    after(async () => {
      await processEvent(event.id);
    });
  }
  return NextResponse.json({ ok: true });
}
