/**
 * Teste de ponta a ponta das regras do núcleo do ERP contra um banco de
 * desenvolvimento/homologação já semeado (npx prisma db seed). Cobre os
 * critérios de aceite do Documento Mestre §10 que dependem de regra de
 * negócio (não de tela):
 *   - pedido com vários itens calcula totais;
 *   - kit baixa as quantidades corretas dos componentes, sem duplicidade
 *     mesmo quando a operação é reprocessada;
 *   - aprovação comercial registra autor e data;
 *   - despacho exige NF autorizada; NF em homologação gera contas a receber
 *     uma única vez; pagamento repetido (mesma requestKey) não baixa duas vezes;
 *   - isolamento: pedido de uma empresa não aparece na outra;
 *   - proposta por link: só o token atual abre, o cliente aprova uma vez e
 *     o pedido segue as mesmas regras do vendedor;
 *   - estoque negativo: com o parâmetro ligado o pedido reserva sem saldo;
 *     desligado, recusa.
 *
 * Uso: npm run erp:selftest   (NUNCA apontar para o banco de produção)
 */
import assert from "node:assert/strict";
import type { Session } from "next-auth";
import { prisma } from "../src/lib/prisma";
import { saveQuote, submitOrder, approveOrder, advanceShipping, getOrderForSession, reserveOrderStock } from "../src/lib/erp/orders";
import { emitForOrder } from "../src/lib/erp/fiscal";
import { registerReceivablePayment } from "../src/lib/erp/finance";
import { createProposalLink, viewProposal, acceptProposal } from "../src/lib/erp/proposal";

if (process.env.NODE_ENV === "production" || /prod/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Recusado: o selftest cria dados e não roda contra produção.");
}

function sessionFor(user: { id: string; name: string; email: string; role: Session["user"]["role"] }): Session {
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, expires: new Date(Date.now() + 3600_000).toISOString() };
}

async function main() {
  const companyA = await prisma.company.findUniqueOrThrow({ where: { code: "A" } });
  const companyB = await prisma.company.findUniqueOrThrow({ where: { code: "B" } });
  const mediatorUser = await prisma.user.findFirstOrThrow({ where: { role: "MEDIATOR", deletedAt: null } });
  const sellerUser = await prisma.user.findFirstOrThrow({ where: { role: "SELLER", deletedAt: null } });
  const stockUsers = await prisma.user.findMany({ where: { role: { in: ["STOCK", "MEDIATOR"] }, deletedAt: null }, take: 2 });
  const mediator = sessionFor(mediatorUser);
  const seller = sessionFor(sellerUser);
  const contact = await prisma.contact.findFirstOrThrow({ where: { ownerId: sellerUser.id, deletedAt: null, cnpj: { not: null } } });

  const led = await prisma.product.findUniqueOrThrow({ where: { companyId_sku: { companyId: companyA.id, sku: "LED-5MM-BR" } } });
  const kit = await prisma.product.findUniqueOrThrow({ where: { companyId_sku: { companyId: companyA.id, sku: "KIT-LED-25" } } });
  const res = await prisma.product.findUniqueOrThrow({ where: { companyId_sku: { companyId: companyA.id, sku: "RES-1K-14W" } } });
  const ledBefore = led.stockReserved;
  const resBefore = res.stockReserved;

  // 1) Cotação com vários itens: 2 kits + 10 LEDs avulsos + 100 resistores.
  const order = await saveQuote(seller, companyA.id, {
    contactId: contact.id,
    installments: 2,
    freight: 15,
    discountTotal: 0,
    items: [
      { productId: kit.id, quantity: 2, unitPrice: 9.9, discountPct: 0 },
      { productId: led.id, quantity: 10, unitPrice: 0.45, discountPct: 0 },
      { productId: res.id, quantity: 100, unitPrice: 0.08, discountPct: 0 },
    ],
  });
  // 2×9,90 + 10×0,45 + 100×0,08 = 19,80 + 4,50 + 8,00 = 32,30; + frete 15 = 47,30
  assert.equal(order.itemsTotal.toFixed(2), "32.30");
  assert.equal(order.total.toFixed(2), "47.30");
  console.log("ok  totais do pedido com vários itens");

  // 2) Dentro dos limites → aprovação automática + reserva.
  const submitted = await submitOrder(seller, companyA.id, order.id);
  assert.equal(submitted?.status, "APROVADO");
  const afterReserve = await prisma.product.findUniqueOrThrow({ where: { id: led.id } });
  // Kit explode: 2 kits × 25 = 50 LEDs + 10 avulsos = 60 reservados.
  assert.equal(afterReserve.stockReserved - ledBefore, 60);
  console.log("ok  kit reserva 25 LEDs por kit (60 no total)");

  // Reprocessar a reserva não reserva de novo.
  await prisma.$transaction((tx) => reserveOrderStock(tx, order.id, null));
  const again = await prisma.product.findUniqueOrThrow({ where: { id: led.id } });
  assert.equal(again.stockReserved - ledBefore, 60);
  const resAfter = await prisma.product.findUniqueOrThrow({ where: { id: res.id } });
  assert.equal(resAfter.stockReserved - resBefore, 100);
  console.log("ok  reprocessamento da reserva é idempotente");

  // 3) Desconto acima do limite exige aprovação; aprovação registra autor/data.
  const big = await saveQuote(seller, companyA.id, {
    contactId: contact.id,
    items: [{ productId: led.id, quantity: 100, unitPrice: 0.45, discountPct: 30 }],
  });
  const pending = await submitOrder(seller, companyA.id, big.id);
  assert.equal(pending?.status, "AGUARDANDO_APROVACAO");
  await assert.rejects(approveOrder(seller, companyA.id, big.id), /gerência|diretoria/i);
  await approveOrder(mediator, companyA.id, big.id);
  const approved = await prisma.salesOrder.findUniqueOrThrow({ where: { id: big.id } });
  assert.equal(approved.approvedById, mediatorUser.id);
  assert.ok(approved.approvedAt);
  console.log("ok  aprovação comercial registra autor e data; vendedor não aprova");

  // 4) Separação → conferência por outra pessoa → despacho exige NF.
  await advanceShipping(mediator, companyA.id, order.id, "start_picking");
  await advanceShipping(mediator, companyA.id, order.id, "picked");
  const checker = sessionFor(stockUsers.find((u) => u.id !== mediatorUser.id) ?? mediatorUser);
  await advanceShipping(checker.user.role === "MEDIATOR" ? mediator : checker, companyA.id, order.id, "checked", { packages: 1, grossWeightKg: 0.4 });
  await assert.rejects(advanceShipping(mediator, companyA.id, order.id, "dispatch", { carrier: "Correios" }), /nota fiscal autorizada/i);
  console.log("ok  despacho bloqueado sem NF autorizada");

  // 5) NF em homologação (simulador) → contas a receber, uma vez só.
  const doc = await emitForOrder(mediator, companyA.id, order.id);
  assert.equal(doc.status, "AUTORIZADA", `NF não autorizada: ${doc.rejectionReason}`);
  assert.equal(doc.accessKey?.length, 44);
  const docAgain = await emitForOrder(mediator, companyA.id, order.id);
  assert.equal(docAgain.id, doc.id);
  const receivables = await prisma.receivable.findMany({ where: { orderId: order.id }, orderBy: { installment: "asc" } });
  assert.equal(receivables.length, 2);
  assert.equal(receivables.reduce((s, r) => s + Number(r.amount), 0).toFixed(2), "47.30");
  console.log("ok  NF autorizada em homologação gera 2 parcelas (sem duplicar ao reemitir)");

  // 6) Despacho baixa o físico e consome a reserva exatamente uma vez.
  const ledPhysBefore = (await prisma.product.findUniqueOrThrow({ where: { id: led.id } })).stockPhysical;
  await advanceShipping(mediator, companyA.id, order.id, "dispatch", { carrier: "Correios", trackingCode: "BR123" });
  const ledAfterShip = await prisma.product.findUniqueOrThrow({ where: { id: led.id } });
  assert.equal(ledPhysBefore - ledAfterShip.stockPhysical, 60);
  await assert.rejects(advanceShipping(mediator, companyA.id, order.id, "dispatch", { carrier: "Correios" }), /Etapa inválida/);
  console.log("ok  expedição baixa 60 LEDs uma única vez");

  // 7) Pagamento parcial com a mesma requestKey não baixa duas vezes.
  const finance = await prisma.user.findFirst({ where: { role: "FINANCE" } });
  const finSession = finance ? sessionFor(finance) : mediator;
  const key = `selftest-${Date.now()}`;
  await registerReceivablePayment(finSession, companyA.id, receivables[0].id, { amount: 10, paidAt: new Date(), requestKey: key });
  await registerReceivablePayment(finSession, companyA.id, receivables[0].id, { amount: 10, paidAt: new Date(), requestKey: key });
  const r0 = await prisma.receivable.findUniqueOrThrow({ where: { id: receivables[0].id } });
  assert.equal(r0.paidAmount.toFixed(2), "10.00");
  assert.equal(r0.status, "PARCIAL");
  console.log("ok  baixa parcial idempotente por requestKey");

  // 8) Isolamento multiempresa: o pedido da empresa A não existe na B.
  assert.equal(await getOrderForSession(mediator, companyB.id, order.id), null);
  // Vendedor (escopo próprio) não vê pedido de outro vendedor.
  const other = await saveQuote(mediator, companyA.id, {
    contactId: contact.id,
    sellerId: mediatorUser.id,
    items: [{ productId: res.id, quantity: 1, unitPrice: 0.08, discountPct: 0 }],
  });
  assert.equal(await getOrderForSession(seller, companyA.id, other.id), null);
  console.log("ok  isolamento entre empresas e carteira do vendedor");

  // 9) Proposta por link: token novo invalida o anterior; aprovação única
  // envia o pedido pelas regras normais; cliente não vê custo.
  const quote = await saveQuote(seller, companyA.id, {
    contactId: contact.id,
    items: [{ productId: res.id, quantity: 10, unitPrice: 0.08, discountPct: 0 }],
  });
  const firstToken = await createProposalLink(seller, companyA.id, quote.id);
  const token = await createProposalLink(seller, companyA.id, quote.id);
  assert.equal(await viewProposal(firstToken), null);
  const viewed = await viewProposal(token);
  assert.ok(viewed && !viewed.expired);
  assert.ok(!("unitCost" in viewed.order.items[0]) && !("internalNotes" in viewed.order));
  await assert.rejects(acceptProposal(token, "ab"), /nome completo/i);
  const accepted = await acceptProposal(token, "Comprador Teste");
  assert.equal(accepted?.already, false);
  assert.equal(accepted?.status, "APROVADO");
  const again2 = await acceptProposal(token, "Comprador Teste");
  assert.equal(again2?.already, true);
  const q2 = await prisma.salesOrder.findUniqueOrThrow({ where: { id: quote.id } });
  assert.equal(q2.proposalAcceptedBy, "Comprador Teste");
  assert.equal(await prisma.orderEvent.count({ where: { orderId: quote.id, type: "proposal_accepted" } }), 1);
  console.log("ok  proposta por link: token único, aprovação única pelas regras do pedido");

  // 10) Estoque negativo: reserva acima do disponível só com o parâmetro ligado.
  const esp = await prisma.product.findUniqueOrThrow({ where: { companyId_sku: { companyId: companyA.id, sku: "MOD-ESP32" } } });
  const tooMuch = Math.max(0, esp.stockPhysical - esp.stockReserved - esp.stockBlocked) + 50;
  const prevFlag = companyA.allowNegativeStock;
  try {
    await prisma.company.update({ where: { id: companyA.id }, data: { allowNegativeStock: false } });
    const blocked = await saveQuote(seller, companyA.id, { contactId: contact.id, items: [{ productId: esp.id, quantity: tooMuch, unitPrice: Number(esp.price), discountPct: 0 }] });
    await assert.rejects(submitOrder(seller, companyA.id, blocked.id), /Saldo insuficiente/);
    await prisma.company.update({ where: { id: companyA.id }, data: { allowNegativeStock: true } });
    const neg = await submitOrder(seller, companyA.id, blocked.id);
    assert.equal(neg?.status, "APROVADO");
    const espAfter = await prisma.product.findUniqueOrThrow({ where: { id: esp.id } });
    assert.ok(espAfter.stockPhysical - espAfter.stockReserved - espAfter.stockBlocked < 0);
  } finally {
    await prisma.company.update({ where: { id: companyA.id }, data: { allowNegativeStock: prevFlag } });
  }
  console.log("ok  estoque negativo só com o parâmetro da empresa ligado");

  console.log("\nTodos os testes do núcleo passaram.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
