import { NextResponse } from "next/server";
import { getFullExportData } from "@/lib/full-export";

/**
 * Backs the scheduled OneDrive sync: returns every client (cadastro),
 * prospecção and negociação in the CRM as JSON. Unlike the other cron route,
 * this always requires CRON_SECRET — it's a full PII/CNPJ/deal-value export,
 * so an unset secret must fail closed (401), never fall through to open
 * access.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse("CRON_SECRET não configurado.", { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const data = await getFullExportData();
  return NextResponse.json(data);
}
