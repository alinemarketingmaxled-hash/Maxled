import { NextResponse } from "next/server";
import { getFullExportData } from "@/lib/full-export";
import { buildFullExportWorkbook } from "@/lib/full-export-xlsx";

/**
 * Backs the scheduled OneDrive/download sync: returns every client
 * (cadastro), prospecção and negociação in the CRM — as JSON by default, or
 * as a ready-to-send .xlsx with `?format=xlsx` (same 3 sheets the daily sync
 * regenerates). Unlike the other cron route, this always requires
 * CRON_SECRET — it's a full PII/CNPJ/deal-value export, so an unset secret
 * must fail closed (500/401), never fall through to open access.
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

  const format = new URL(request.url).searchParams.get("format");
  if (format === "xlsx") {
    const workbook = buildFullExportWorkbook(data);
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Crm_max_led.xlsx"',
      },
    });
  }

  return NextResponse.json(data);
}
