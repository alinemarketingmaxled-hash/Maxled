import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canView } from "@/lib/permissions";
import { resolveReportContext } from "@/lib/erp/report-context";
import { reportToCsv, runReport } from "@/lib/erp/reports";

/** Exporta a aba atual do relatório em CSV, com as mesmas checagens de
 * permissão, escopo e empresa da página. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "CUSTOMER" || !canView(session.user.role, "relatorios")) {
    return new NextResponse("Não autorizado", { status: 401 });
  }
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  let ctx;
  try {
    ctx = await resolveReportContext(session, sp);
  } catch {
    return new NextResponse("Sem empresa vinculada", { status: 403 });
  }
  if (!ctx.tab || (sp.aba && ctx.tab !== sp.aba)) return new NextResponse("Relatório não permitido", { status: 403 });

  const result = await runReport(session, ctx.tab, ctx.companyIds, ctx.filters, ctx.companyLabel);
  const scopeName = ctx.consolidated ? "consolidado" : ctx.ctx.active.code;
  const filename = `relatorio-${ctx.tab}-${scopeName}-${ctx.filters.fromStr}-a-${ctx.filters.toStr}.csv`;
  return new NextResponse(reportToCsv(result), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
