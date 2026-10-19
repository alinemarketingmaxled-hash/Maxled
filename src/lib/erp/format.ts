/** Formatação compartilhada entre server e client components do ERP. */
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR");

export function fmtMoney(v: number | string | { toString(): string } | null | undefined) {
  if (v === null || v === undefined || v === "") return "-";
  return brl.format(Number(v.toString()));
}

export function fmtNumber(v: number | null | undefined) {
  return v === null || v === undefined ? "-" : num.format(v);
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function orderCode(companyCode: string, number: number) {
  return `${companyCode}-${String(number).padStart(5, "0")}`;
}
