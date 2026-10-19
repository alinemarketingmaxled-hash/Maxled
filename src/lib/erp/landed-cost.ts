import type { Prisma } from "@/generated/prisma/client";
import { D } from "@/lib/erp/money";

export type CostAllocation = "VALOR" | "QUANTIDADE" | "PESO";

type LandedInput = {
  exchangeRate: Prisma.Decimal | number | string;
  freight: Prisma.Decimal | number | string;
  insurance: Prisma.Decimal | number | string;
  customsExpenses: Prisma.Decimal | number | string;
  importTaxes: Prisma.Decimal | number | string;
  otherExpenses: Prisma.Decimal | number | string;
  costAllocation: string;
  items: {
    id: string;
    quantity: number;
    unitCostForeign: Prisma.Decimal | number | string;
    product: { weightKg: Prisma.Decimal | number | string | null };
  }[];
};

/**
 * Custo de entrada (§4.9): despesas da compra (frete, seguro, aduaneiras,
 * tributos, outras) rateadas entre os itens pelo critério escolhido.
 * PESO sem peso cadastrado em algum item cai para VALOR (`fallback`), para
 * nunca ratear com base incompleta. Função pura — sem banco — para poder ser
 * testada isoladamente.
 */
export function computeLandedCosts(po: LandedInput) {
  const rate = D(po.exchangeRate);
  const expenses = D(po.freight).add(D(po.insurance)).add(D(po.customsExpenses)).add(D(po.importTaxes)).add(D(po.otherExpenses));
  let method = (["VALOR", "QUANTIDADE", "PESO"].includes(po.costAllocation) ? po.costAllocation : "VALOR") as CostAllocation;
  let fallback = false;
  if (method === "PESO" && po.items.some((i) => i.product.weightKg === null || D(i.product.weightKg).lessThanOrEqualTo(0))) {
    method = "VALOR";
    fallback = true;
  }

  const rows = po.items.map((i) => {
    const brl = D(i.unitCostForeign).mul(i.quantity).mul(rate);
    const basis =
      method === "VALOR" ? brl : method === "QUANTIDADE" ? D(i.quantity) : D(i.product.weightKg ?? 0).mul(i.quantity);
    return { id: i.id, quantity: i.quantity, brl, basis };
  });
  const totalBasis = rows.reduce((s, r) => s.add(r.basis), D(0));

  const byItem = new Map<string, { brlTotal: Prisma.Decimal; share: Prisma.Decimal; landedUnitCost: Prisma.Decimal }>();
  for (const r of rows) {
    // Base zero (ex.: tudo a custo 0 no rateio por valor): divide igualmente.
    const share = totalBasis.greaterThan(0) ? expenses.mul(r.basis).div(totalBasis) : expenses.div(rows.length || 1);
    const landedUnitCost = r.quantity > 0 ? r.brl.add(share).div(r.quantity).toDecimalPlaces(4) : D(0);
    byItem.set(r.id, { brlTotal: r.brl.toDecimalPlaces(2), share: share.toDecimalPlaces(2), landedUnitCost });
  }
  return { method, fallback, expenses, byItem };
}
