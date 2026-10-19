import type { SalesChannel, SalesOrderStatus } from "@/generated/prisma/client";

/** Rótulos curtos para badges/listas (os longos ficam em lib/erp/orders.ts,
 * que é server-only e não pode ir para client components). */
export const ORDER_STATUS_LABELS_SHORT: Record<SalesOrderStatus, string> = {
  COTACAO: "Cotação",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  EM_SEPARACAO: "Em separação",
  EM_CONFERENCIA: "Em conferência",
  PRONTO_EXPEDICAO: "Pronto p/ expedição",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export const CHANNEL_LABELS_SHORT: Record<SalesChannel, string> = {
  DIRETO: "Direto",
  MERCADO_LIVRE: "Mercado Livre",
  PORTAL: "Portal",
  OUTRO: "Outro",
};

export const PAYMENT_METHODS = ["Boleto", "PIX", "Transferência", "Cartão de crédito", "Dinheiro", "Mercado Pago"];
