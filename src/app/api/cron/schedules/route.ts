import { NextResponse } from "next/server";
import { processSchedules } from "@/lib/erp/schedules";

/**
 * Programação de clientes (Documento Mestre §4.8): processa as ocorrências
 * vencidas de todas as empresas, gerando cotações (sem reserva de estoque)
 * ou tarefas para o responsável. Idempotente — pode rodar mais de uma vez
 * por dia. Agendar num cron diário com `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Não autorizado", { status: 401 });
    }
  }

  const result = await processSchedules({});
  return NextResponse.json(result);
}
