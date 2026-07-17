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
const CANONICAL_IDS = new Set(PROSPECT_STAGE_DEFS.map((s) => s.id));
const FIRST_CANONICAL_STAGE_ID = "prospect-stage-prospeccao";

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
      update: { name: s.name, order: s.order, isClientStage: s.isClientStage ?? false, isCustom: false },
      create: { id: s.id, name: s.name, order: s.order, isClientStage: s.isClientStage ?? false, isCustom: false },
    });
  }
}

/** Cheap existence check for the layout's per-request self-heal — avoids
 * running the full reconcile on every single page load when the data is
 * already correct, which is the common case. */
export async function areProspectStagesSeeded() {
  const row = await prisma.prospectStage.findUnique({
    where: { id: FIRST_CANONICAL_STAGE_ID },
    select: { id: true },
  });
  return row !== null;
}

/** Cleans up leftover stage rows from before custom columns were flagged
 * (isCustom didn't exist yet) or from an earlier free-form "add column"
 * feature: any non-canonical row gets flagged isCustom + pushed to sort
 * after the 6 fixed ones, and rows sharing the same name are merged into
 * one, moving their prospect data along so nothing is lost. Idempotent —
 * a no-op once the data is clean. */
export async function reconcileCustomProspectStages() {
  await prisma.$transaction(async (tx) => {
    const all = await tx.prospectStage.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    const strays = all.filter((s) => !CANONICAL_IDS.has(s.id));
    if (strays.length === 0) return;

    let nextOrder = 6;
    for (const s of strays) {
      if (!s.isCustom || s.order !== nextOrder) {
        await tx.prospectStage.update({ where: { id: s.id }, data: { isCustom: true, order: nextOrder } });
      }
      nextOrder += 1;
    }

    const byName = new Map<string, typeof strays>();
    for (const s of strays) {
      const key = s.name.trim().toLowerCase();
      const group = byName.get(key);
      if (group) group.push(s);
      else byName.set(key, [s]);
    }

    for (const group of byName.values()) {
      if (group.length < 2) continue;
      const [keeper, ...losers] = group;
      for (const loser of losers) {
        const values = await tx.prospectStageValue.findMany({ where: { stageId: loser.id } });
        for (const v of values) {
          const clash = await tx.prospectStageValue.findUnique({
            where: { prospectId_stageId: { prospectId: v.prospectId, stageId: keeper.id } },
          });
          if (clash) {
            await tx.prospectStageValue.delete({ where: { id: v.id } });
          } else {
            await tx.prospectStageValue.update({ where: { id: v.id }, data: { stageId: keeper.id } });
          }
        }
        await tx.prospect.updateMany({ where: { currentStageId: loser.id }, data: { currentStageId: keeper.id } });
        await tx.prospectStage.delete({ where: { id: loser.id } });
      }
    }
  });
}

export type CustomProspectStageInput = { name: string };

/** Appends a new custom column after every existing one (fixed + custom),
 * so the 6 canonical stages always stay first regardless of how many
 * custom ones exist. */
export async function addCustomProspectStage(name: string) {
  const last = await prisma.prospectStage.findFirst({ orderBy: { order: "desc" } });
  const order = (last?.order ?? -1) + 1;
  return prisma.prospectStage.create({ data: { name, order, isCustom: true } });
}

export async function renameCustomProspectStage(stageId: string, name: string) {
  const stage = await prisma.prospectStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new Error("Coluna não encontrada.");
  if (!stage.isCustom) throw new Error("Essa coluna é fixa e não pode ser renomeada.");
  await prisma.prospectStage.update({ where: { id: stageId }, data: { name } });
}

/** Deletes a custom column and everything filled in under it. Prospects
 * whose "high water mark" pointed at it fall back to the first fixed
 * stage — that pointer is internal bookkeeping only (§upsertProspectStageValue),
 * not something shown in the board, so resetting it is safe. */
export async function deleteCustomProspectStage(stageId: string) {
  const stage = await prisma.prospectStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new Error("Coluna não encontrada.");
  if (!stage.isCustom) throw new Error("Essa coluna é fixa e não pode ser excluída.");
  await prisma.$transaction([
    prisma.prospectStageValue.deleteMany({ where: { stageId } }),
    prisma.prospect.updateMany({ where: { currentStageId: stageId }, data: { currentStageId: FIRST_CANONICAL_STAGE_ID } }),
    prisma.prospectStage.delete({ where: { id: stageId } }),
  ]);
}
