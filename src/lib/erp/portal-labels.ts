import type { SalesOrderStatus } from "@/generated/prisma/client";

/** Status em linguagem de cliente — sem detalhes internos de aprovação. */
export const PORTAL_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  COTACAO: "Cotação",
  AGUARDANDO_APROVACAO: "Em análise",
  APROVADO: "Confirmado",
  EM_SEPARACAO: "Em separação",
  EM_CONFERENCIA: "Em conferência",
  PRONTO_EXPEDICAO: "Pronto para envio",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

/** Eventos da linha do tempo que o cliente pode ver, com texto próprio
 * (as mensagens internas citam usuários e regras comerciais). */
export const PORTAL_EVENT_LABELS: Record<string, string> = {
  created: "Pedido registrado",
  approved: "Pedido confirmado",
  fiscal_authorized: "Nota fiscal emitida",
  dispatched: "Pedido despachado",
  delivered: "Entrega confirmada",
  cancelled: "Pedido cancelado",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  CADASTRO: "Atualização cadastral",
  CONTATO: "Falar com a MAX LED",
  PROGRAMACAO: "Alteração de programação",
};

export function companyLabel(c: { name: string; tradeName: string | null }) {
  return c.tradeName || c.name;
}
