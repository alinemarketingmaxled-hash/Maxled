import { NextResponse } from "next/server";
import { seedProduction } from "@/lib/seed-production";

/**
 * One-time production bootstrap endpoint — creates the mediator account and
 * default pipeline on a fresh database. Gated behind AUTH_SECRET (already a
 * required, private env var) rather than adding a dedicated secret just for
 * this. Accepts the secret as a Bearer header or a `?secret=` query param —
 * the latter so it can be triggered from a plain browser address bar. Safe
 * to call more than once; every write upserts.
 */
export async function GET(request: Request) {
  const secret = process.env.AUTH_SECRET;
  const auth = request.headers.get("authorization");
  const queryToken = new URL(request.url).searchParams.get("secret");
  const authorized = auth === `Bearer ${secret}` || (secret && queryToken === secret);

  if (!secret || !authorized) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const result = await seedProduction();
  return NextResponse.json(result);
}
