import type { SalesOrderStatus } from "@/generated/prisma/client";
import { ORDER_STATUS_LABELS_SHORT } from "@/components/erp/pedidos/labels";
import { Badge, type Tone } from "@/components/erp/ui";

const TONES: Record<SalesOrderStatus, Tone> = {
  COTACAO: "neutral",
  AGUARDANDO_APROVACAO: "warning",
  APROVADO: "info",
  EM_SEPARACAO: "gold",
  EM_CONFERENCIA: "gold",
  PRONTO_EXPEDICAO: "gold",
  ENVIADO: "good",
  ENTREGUE: "good",
  CANCELADO: "critical",
};

export function OrderStatusBadge({ status }: { status: SalesOrderStatus }) {
  return <Badge tone={TONES[status]}>{ORDER_STATUS_LABELS_SHORT[status]}</Badge>;
}
