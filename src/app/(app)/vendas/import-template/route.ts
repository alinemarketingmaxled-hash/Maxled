import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEdit } from "@/lib/permissions";
import { buildImportTemplate } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user || !canEdit(session.user.role, "vendas")) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  return new NextResponse(buildImportTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="maxled-modelo-importacao.csv"',
    },
  });
}
