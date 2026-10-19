import { Prisma } from "@/generated/prisma/client";

type DecimalValue = Prisma.Decimal | number | string;

/** Toda conta de dinheiro do ERP passa por Decimal (nunca float) e arredonda
 * para centavos só no fim de cada linha — os totais batem com a soma das
 * linhas exibidas. */
export const D = (v: DecimalValue | null | undefined) => new Prisma.Decimal(v ?? 0);

export function round2(v: DecimalValue) {
  return D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function lineSubtotal(quantity: number, unitPrice: DecimalValue, discountPct: DecimalValue) {
  return round2(D(unitPrice).mul(quantity).mul(D(100).sub(D(discountPct))).div(100));
}

/** Divide um total em N parcelas de centavos; a diferença de arredondamento
 * vai para a primeira, para a soma bater exatamente. */
export function splitInstallments(total: DecimalValue, n: number): Prisma.Decimal[] {
  const count = Math.max(1, Math.floor(n));
  const cents = D(total).mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  const base = Math.floor(cents / count);
  const rest = cents - base * count;
  return Array.from({ length: count }, (_, i) => D(base + (i === 0 ? rest : 0)).div(100));
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
