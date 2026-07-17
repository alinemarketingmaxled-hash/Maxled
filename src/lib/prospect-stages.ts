import { prisma } from "@/lib/prisma";

/** No "server-only" guard here (unlike prospects.ts) — this module is also
 * imported by prisma/seed.ts, which runs as a plain Node/tsx script outside
 * of Next.js, where the "server-only" marker package throws on import. */
const PROSPECT_STAGE_DEFS = [
  { id: "prospect-stage-prospeccao", name: "Prospecção", order: 0 },
  { id: "prospect-stage-0", name: "Conversação", order: 1 },
  { id: "prospect-stage-1", name: "Retorno", order: 2 },
  { id: "prospect-stage-2", name: "Cotação", order: 3 },
  { id: "prospect-stage-3", name: "Negociação", order: 4 },
  { id: "prospect-stage-4", name: "Cliente Ativo", order: 5, isClientStage: true },
];

/** Upserts the 6 fixed Prospecções stages. Idempotent — safe to call on
 * every request. Used both by the one-time seed scripts and by the
 * request-path self-heal check in the app layout, so environments whose
 * data predates a stage-list change (like production before this was
 * added) fix themselves on the next request instead of needing a manual
 * seed run. */
export async function ensureProspectStagesSeeded() {
  for (const s of PROSPECT_STAGE_DEFS) {
    await prisma.prospectStage.upsert({
      where: { id: s.id },
      update: { name: s.name, order: s.order, isClientStage: s.isClientStage ?? false },
      create: { id: s.id, name: s.name, order: s.order, isClientStage: s.isClientStage ?? false },
    });
  }
}

/** Cheap existence check for the layout's per-request self-heal — avoids
 * running 6 upserts on every single page load when the data is already
 * correct, which is the common case. */
export async function areProspectStagesSeeded() {
  const row = await prisma.prospectStage.findUnique({
    where: { id: "prospect-stage-prospeccao" },
    select: { id: true },
  });
  return row !== null;
}
