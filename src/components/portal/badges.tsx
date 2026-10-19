import type { FinancialStatus, SalesOrderStatus } from "@/generated/prisma/client";
import { Badge, type Tone } from "@/components/erp/ui";
import { PORTAL_STATUS_LABELS } from "@/lib/erp/portal-labels";

const ORDER_TONE: Record<SalesOrderStatus, Tone> = {
  COTACAO: "neutral",
  AGUARDANDO_APROVACAO: "warning",
  APROVADO: "info",
  EM_SEPARACAO: "info",
  EM_CONFERENCIA: "info",
  PRONTO_EXPEDICAO: "info",
  ENVIADO: "gold",
  ENTREGUE: "good",
  CANCELADO: "critical",
};

export function OrderStatusBadge({ status }: { status: SalesOrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{PORTAL_STATUS_LABELS[status]}</Badge>;
}

/** Título vencido aparece como "Vencido" mesmo com status ABERTO/PARCIAL. */
export function TitleStatusBadge({ status, dueDate }: { status: FinancialStatus; dueDate: Date }) {
  if (status === "PAGO") return <Badge tone="good">Pago</Badge>;
  if (status === "CANCELADO") return <Badge tone="neutral">Cancelado</Badge>;
  const overdue = dueDate < new Date(new Date().setHours(0, 0, 0, 0));
  if (overdue) return <Badge tone="critical">Vencido</Badge>;
  return <Badge tone={status === "PARCIAL" ? "warning" : "info"}>{status === "PARCIAL" ? "Pago parcialmente" : "Em aberto"}</Badge>;
}
