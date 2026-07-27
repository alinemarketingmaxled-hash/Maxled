import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canView } from "@/lib/permissions";
import { getFullExportData } from "@/lib/full-export";
import { buildFullExportWorkbook } from "@/lib/full-export-xlsx";

/**
 * Backs the "Exportar tudo" button in Config — always-live download of every
 * client, prospecção and negociação, straight from the browser. Session-
 * gated by the "config" module (Mediador-only), not CRON_SECRET: a real user
 * request, not the scheduled/automation path in /api/cron/full-export.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || !canView(session.user.role, "config")) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const data = await getFullExportData();
  const workbook = buildFullExportWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Crm_max_led.xlsx"',
    },
  });
}
