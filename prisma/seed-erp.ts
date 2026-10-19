import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

/** Dados de homologação do ERP (só desenvolvimento/homologação — nunca
 * roda em produção). Idempotente: pode ser executado várias vezes. */
export async function seedErp(sellerId: string, contactId: string) {
  const companyA = await prisma.company.upsert({
    where: { code: "A" },
    update: {},
    create: { id: "company-a", code: "A", name: "MAX LED Iluminação e Tecnologia" },
  });
  const companyB = await prisma.company.upsert({
    where: { code: "B" },
    update: {},
    create: { id: "company-b", code: "B", name: "MAX LED Importação e Exportação" },
  });
  // CNPJs fictícios de teste — substituir pelos reais confirmados pela contabilidade.
  await prisma.company.update({
    where: { id: companyA.id },
    data: { cnpj: "11.222.333/0001-81", stateRegistration: "123456789110", state: "SP", city: "São Paulo", postalCode: "01001-000", street: "Rua Exemplo", number: "100", taxRegime: "A confirmar" },
  });
  await prisma.company.update({
    where: { id: companyB.id },
    data: { cnpj: "44.555.666/0001-71", state: "SP", city: "Santos", postalCode: "11010-000", taxRegime: "A confirmar" },
  });

  const passwordHash = await bcrypt.hash("maxled123", 10);
  const staff = [
    { email: "gerente@maxledtec.com.br", name: "Gerente Comercial", role: "SALES_MANAGER" as const, companies: [companyA.id, companyB.id] },
    { email: "diretoria@maxledtec.com.br", name: "Diretoria", role: "MANAGER" as const, companies: [companyA.id, companyB.id] },
    { email: "estoque@maxledtec.com.br", name: "Equipe Estoque", role: "STOCK" as const, companies: [companyA.id] },
    { email: "compras@maxledtec.com.br", name: "Equipe Compras", role: "PURCHASING" as const, companies: [companyA.id, companyB.id] },
    { email: "financeiro@maxledtec.com.br", name: "Equipe Financeiro", role: "FINANCE" as const, companies: [companyA.id, companyB.id] },
    { email: "fiscal@maxledtec.com.br", name: "Equipe Fiscal", role: "FISCAL" as const, companies: [companyA.id, companyB.id] },
    { email: "marketing@maxledtec.com.br", name: "Marketing", role: "MARKETING" as const, companies: [companyA.id] },
  ];
  for (const s of staff) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, name: s.name, role: s.role, passwordHash },
    });
    for (const companyId of s.companies) {
      await prisma.userCompany.upsert({
        where: { userId_companyId: { userId: user.id, companyId } },
        update: {},
        create: { userId: user.id, companyId },
      });
    }
  }
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: sellerId, companyId: companyA.id } },
    update: {},
    create: { userId: sellerId, companyId: companyA.id },
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: { cnpj: "12.345.678/0001-95", personType: "JURIDICA", city: "Porto Alegre", state: "RS", postalCode: "90160-090" },
  });

  const products = [
    { sku: "LED-5MM-BR", name: "LED 5mm branco alto brilho", family: "LEDs", ncm: "85414100", price: 0.45, minPrice: 0.35, cost: 0.12, stock: 5000, minStock: 1000 },
    { sku: "LED-3MM-VM", name: "LED 3mm vermelho difuso", family: "LEDs", ncm: "85414100", price: 0.3, minPrice: 0.22, cost: 0.08, stock: 300, minStock: 500 },
    { sku: "RES-1K-14W", name: "Resistor 1kΩ 1/4W 5%", family: "Resistores", ncm: "85332190", price: 0.08, minPrice: 0.05, cost: 0.01, stock: 20000, minStock: 2000 },
    { sku: "CAP-100UF-25V", name: "Capacitor eletrolítico 100µF 25V", family: "Capacitores", ncm: "85322200", price: 0.6, minPrice: 0.45, cost: 0.18, stock: 1500, minStock: 300 },
    { sku: "DIO-1N4007", name: "Diodo retificador 1N4007", family: "Diodos", ncm: "85411000", price: 0.15, minPrice: 0.1, cost: 0.03, stock: 8000, minStock: 1000 },
    { sku: "REL-12V-10A", name: "Relé 12V 10A 1 contato", family: "Relés", ncm: "85364900", price: 6.9, minPrice: 5.5, cost: 2.4, stock: 120, minStock: 50 },
    { sku: "MOD-ESP32", name: "Módulo ESP32 DevKit", family: "Módulos", ncm: "85176299", price: 49.9, minPrice: 42, cost: 21.5, stock: 40, minStock: 10 },
  ];
  const ids: Record<string, string> = {};
  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { companyId_sku: { companyId: companyA.id, sku: p.sku } } });
    if (existing) {
      ids[p.sku] = existing.id;
      continue;
    }
    const created = await prisma.product.create({
      data: {
        companyId: companyA.id, sku: p.sku, name: p.name, family: p.family, ncm: p.ncm, origin: 0,
        price: p.price, minPrice: p.minPrice, cost: p.cost, minStock: p.minStock, stockPhysical: p.stock, brand: "Max LED",
      },
    });
    ids[p.sku] = created.id;
    await prisma.stockMovement.create({
      data: {
        companyId: companyA.id, productId: created.id, type: "ENTRADA", quantity: p.stock,
        physicalAfter: p.stock, reservedAfter: 0, blockedAfter: 0, reason: "Saldo inicial (homologação)",
        idempotencyKey: `seed:initial:${created.id}`,
      },
    });
  }

  const kit = await prisma.product.findUnique({ where: { companyId_sku: { companyId: companyA.id, sku: "KIT-LED-25" } } });
  if (!kit) {
    await prisma.product.create({
      data: {
        companyId: companyA.id, sku: "KIT-LED-25", name: "Kit 25 LEDs 5mm brancos", family: "LEDs", kind: "KIT",
        ncm: "85414100", price: 9.9, minPrice: 8, packQty: 25,
        components: { create: [{ componentId: ids["LED-5MM-BR"], quantity: 25 }] },
      },
    });
  }

  const supplier = await prisma.supplier.findFirst({ where: { companyId: companyB.id, name: "Shenzhen Opto Co." } });
  if (!supplier) {
    await prisma.supplier.create({
      data: { companyId: companyB.id, name: "Shenzhen Opto Co.", country: "China", currency: "USD", email: "sales@example.cn", leadTimeDays: 45, rating: 4 },
    });
  }
  const supplierA = await prisma.supplier.findFirst({ where: { companyId: companyA.id, name: "Distribuidora Componentes SP" } });
  if (!supplierA) {
    await prisma.supplier.create({
      data: { companyId: companyA.id, name: "Distribuidora Componentes SP", document: "33.444.555/0001-02", leadTimeDays: 5, rating: 5 },
    });
  }

  console.log({ erp: "ok", companies: [companyA.code, companyB.code], products: Object.keys(ids).length + 1 });
}
