import type { PurchaseStatus } from "@/generated/prisma/client";
import type { Tone } from "@/components/erp/ui";

export const PURCHASE_STATUS_TONE: Record<PurchaseStatus, Tone> = {
  SOLICITADO: "neutral",
  COTACAO: "info",
  APROVADO: "gold",
  RECEBIDO_PARCIAL: "warning",
  RECEBIDO: "good",
  CANCELADO: "critical",
};
