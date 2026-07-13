import { NextResponse } from "next/server";
import { checkAndAdvanceOverdueDeals } from "@/lib/deals";

/**
 * Scheduled half of the Agenda automation (docs/CRM-SPEC.md §3.4/§5): moves
 * any deal past its "A caminho" deadline into the next stage. Wire this up
 * to a daily cron once deployed (e.g. Vercel Cron via vercel.json) hitting
 * this URL with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Não autorizado", { status: 401 });
    }
  }

  const advanced = await checkAndAdvanceOverdueDeals();
  return NextResponse.json({ advanced });
}
