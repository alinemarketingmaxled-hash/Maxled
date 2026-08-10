import { NextResponse } from "next/server";
import { checkAndAdvanceOverdueDeals } from "@/lib/deals";

/**
 * Scheduled half of the Agenda automation (docs/CRM-SPEC.md §3.4/§5): moves
 * any deal past its "A caminho" deadline into the next stage. Wired up to
 * a daily cron (vercel.json) — Vercel Cron automatically sends
 * `Authorization: Bearer $CRON_SECRET` when that env var is set on the
 * project, so this must fail closed (500) if it's missing, same as its
 * sibling /api/cron/full-export — an unset secret must never fall through
 * to open access.
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

  const advanced = await checkAndAdvanceOverdueDeals();
  return NextResponse.json({ advanced });
}
