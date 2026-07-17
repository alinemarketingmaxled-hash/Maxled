import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { ensureProspectStagesSeeded } from "../src/lib/prospect-stages";

async function main() {
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

  const seller = await prisma.user.upsert({
    where: { email: "vendedor@maxledtec.com.br" },
    update: {},
    create: {
      name: "Bruno Alves",
      email: "vendedor@maxledtec.com.br",
      passwordHash,
      role: "SELLER",
      jobTitle: "Vendedor",
      goal1: 50000,
      goal2: 80000,
      commissionPct1: 3,
      commissionPct2: 5,
      birthday: new Date("1994-09-02"),
    },
  });

  const pipeline = await prisma.pipeline.upsert({
    where: { id: "default-pipeline" },
    update: {},
    create: {
      id: "default-pipeline",
      name: "Vendas",
      isDefault: true,
    },
  });

  const stageNames = [
    { name: "Novo contato", order: 0 },
    { name: "Proposta enviada", order: 1 },
    { name: "Negociação", order: 2 },
    { name: "A caminho", order: 3, isOnTheWay: true },
    { name: "Fechado", order: 4, isWon: true },
  ];

  const stages = [];
  for (const s of stageNames) {
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

  await ensureProspectStagesSeeded();

  const firstStage = stages[0];
  const contact = await prisma.contact.upsert({
    where: { id: "seed-contact-1" },
    update: {},
    create: {
      id: "seed-contact-1",
      ownerId: seller.id,
      firstName: "Renata",
      lastName: "Souza",
      accountName: "Distribuidora Sul",
      email: "renata@distsul.com.br",
      mobile: "(51) 99988-2210",
      phone: "(51) 3222-1090",
      leadSource: "Indicação",
      supplierName: "Maxled Distribuição SP",
      jobTitle: "Compradora",
      department: "Suprimentos",
      street: "Av. Ipiranga",
      number: "1420",
      city: "Porto Alegre",
      state: "RS",
      postalCode: "90160-093",
      latitude: -30.0346,
      longitude: -51.2177,
    },
  });

  await prisma.deal.upsert({
    where: { id: "seed-deal-1" },
    update: {},
    create: {
      id: "seed-deal-1",
      ownerId: seller.id,
      contactId: contact.id,
      stageId: firstStage.id,
      name: "Distribuidora Sul — Refil #4471",
      value: 18400,
    },
  });

  const wonStage = stages.find((s) => s.isWon)!;
  const negotiationStage = stages[2];
  const wonDeals = [
    { id: "seed-deal-2", name: "Distribuidora Sul — Pedido #4102", value: 22900 },
    { id: "seed-deal-3", name: "Distribuidora Sul — Showroom", value: 31100 },
  ];
  for (const d of wonDeals) {
    await prisma.deal.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        ownerId: seller.id,
        contactId: contact.id,
        stageId: wonStage.id,
        name: d.name,
        value: d.value,
      },
    });
  }
  await prisma.deal.upsert({
    where: { id: "seed-deal-4" },
    update: {},
    create: {
      id: "seed-deal-4",
      ownerId: seller.id,
      contactId: contact.id,
      stageId: negotiationStage.id,
      name: "Distribuidora Sul — Ampliação galpão",
      value: 12750,
    },
  });

  console.log({ mediator: mediator.email, seller: seller.email, pipeline: pipeline.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
