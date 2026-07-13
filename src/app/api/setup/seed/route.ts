import { NextResponse } from "next/server";
import { seedProduction } from "@/lib/seed-production";

/**
 * One-time production bootstrap endpoint — creates the mediator account and
 * default pipeline on a fresh database. Gated behind AUTH_SECRET (already a
 * required, private env var) rather than adding a dedicated secret just for
 * this. Safe to call more than once; every write upserts.
 */
export async function GET(request: Request) {
  const secret = process.env.AUTH_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const result = await seedProduction();
  return NextResponse.json(result);
}
