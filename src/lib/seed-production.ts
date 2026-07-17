import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * One-time production bootstrap: the mediator account + a default pipeline
 * with the standard stages. No demo contacts/deals (unlike prisma/seed.ts,
 * which is for local dev). Safe to call more than once — every write is an
 * upsert. Triggered via GET /api/setup/seed (see that route for the secret).
 */
export async function seedProduction() {
  const passwordHash = await bcrypt.hash("maxled123", 10);

  const mediator = await prisma.user.upsert({
    where: { email: "aline.marketing.maxled@gmail.com" },
    update: {},
    create: {
      name: "Aline",
      email: "aline.marketing.maxled@gmail.com",
      passwordHash,
      role: "MEDIATOR",
      jobTitle: "Mediadora",
    },
  });

  const pipeline = await prisma.pipeline.upsert({
    where: { id: "default-pipeline" },
    update: {},
    create: { id: "default-pipeline", name: "Vendas", isDefault: true },
  });

  const stageDefs = [
    { name: "Novo contato", order: 0 },
    { name: "Proposta enviada", order: 1 },
    { name: "Negociação", order: 2 },
    { name: "A caminho", order: 3, isOnTheWay: true },
    { name: "Fechado", order: 4, isWon: true },
  ];

  const stages = [];
  for (const s of stageDefs) {
    const stage = await prisma.pipelineStage.upsert({
      where: { id: `${pipeline.id}-${s.order}` },
      update: { isOnTheWay: s.isOnTheWay ?? false, isWon: s.isWon ?? false },
      create: {
        id: `${pipeline.id}-${s.order}`,
        pipelineId: pipeline.id,
        name: s.name,
        order: s.order,
        isOnTheWay: s.isOnTheWay ?? false,
        isWon: s.isWon ?? false,
      },
    });
    stages.push(stage);
  }

  const onTheWayStage = stages.find((s) => s.isOnTheWay)!;
  const closedStage = stages[stages.length - 1];
  await prisma.pipelineStage.update({
    where: { id: onTheWayStage.id },
    data: { autoAdvanceToStageId: closedStage.id },
  });

  const prospectStageDefs = [
    { name: "Conversação", order: 0 },
    { name: "Retorno", order: 1 },
    { name: "Cotação", order: 2 },
    { name: "Negociação", order: 3 },
    { name: "Cliente Ativo", order: 4, isClientStage: true },
  ];
  for (const s of prospectStageDefs) {
    await prisma.prospectStage.upsert({
      where: { id: `prospect-stage-${s.order}` },
      update: {},
      create: {
        id: `prospect-stage-${s.order}`,
        name: s.name,
        order: s.order,
        isClientStage: s.isClientStage ?? false,
      },
    });
  }

  return { mediatorEmail: mediator.email, pipeline: pipeline.name };
}
