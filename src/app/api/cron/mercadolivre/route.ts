import { NextResponse } from "next/server";
import { retryPendingEvents } from "@/lib/erp/integrations";

/**
 * Reprocessa eventos de integração com erro/pendentes (até 5 tentativas).
 * Agendar com `Authorization: Bearer $CRON_SECRET` (ex.: Vercel Cron).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Não autorizado", { status: 401 });
    }
  }
  const results = await retryPendingEvents();
  return NextResponse.json({ retried: results.length, results });
}
