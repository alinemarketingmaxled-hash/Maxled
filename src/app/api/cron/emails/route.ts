import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/erp/mail-sync";

/**
 * Sincronização periódica das caixas de e-mail (Documento Mestre §4.13).
 * Agende no cron do provedor (ex.: Vercel Cron em vercel.json) chamando
 * esta URL com `Authorization: Bearer $CRON_SECRET`.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Não autorizado", { status: 401 });
    }
  }

  const results = await syncAllAccounts();
  return NextResponse.json({ results });
}
