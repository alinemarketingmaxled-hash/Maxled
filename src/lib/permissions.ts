import type { Role } from "@/generated/prisma/client";

export type Module =
  | "analitica"
  | "vendas"
  | "negocios"
  | "prospeccoes"
  | "agenda"
  | "social"
  | "ia"
  | "perfil"
  | "config"
  | "activityLogs"
  // ERP (Documento Mestre §4)
  | "painel"
  | "produtos"
  | "estoque"
  | "pedidos"
  | "expedicao"
  | "compras"
  | "fiscal"
  | "financeiro"
  | "programacao"
  | "mercadolivre"
  | "emails"
  | "relatorios"
  | "empresas"
  | "portalAdmin";

export type Level = "none" | "view" | "edit";
export type Scope = "none" | "own" | "team" | "all";

export type Permission = { level: Level; scope: Scope };

/**
 * Mirrors the access matrix in docs/CRM-SPEC.md §6. "own" means a user only
 * ever sees their own records; "team" aggregates across users (Manager+);
 * "all" is the cross-profile view reserved for Admin/Mediador.
 */
const N: Permission = { level: "none", scope: "none" };
const VO: Permission = { level: "view", scope: "own" };
const VT: Permission = { level: "view", scope: "team" };
const VA: Permission = { level: "view", scope: "all" };
const EO: Permission = { level: "edit", scope: "own" };
const ET: Permission = { level: "edit", scope: "team" };
const EA: Permission = { level: "edit", scope: "all" };

/**
 * Mirrors the access matrix in docs/CRM-SPEC.md §6 for the CRM modules and
 * the profile table in docs/ERP.md for the ERP ones. "own" means a user
 * only ever sees their own records; "team" aggregates across users
 * (Manager+); "all" is the cross-profile view. Every server action and page
 * re-checks this — hiding a menu item is never the only guard.
 *
 * Role labels: MANAGER = Diretoria, SALES_MANAGER = Gerente comercial,
 * MEDIATOR = Mediador (superusuário), CUSTOMER = sessão do Portal (nega
 * tudo aqui; o portal tem checagem própria).
 */
const MATRIX: Record<Module, Record<Role, Permission>> = {
  analitica: {
    SELLER: EO, SUPPORT: VO, MANAGER: ET, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: ET, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: VT, CUSTOMER: N,
  },
  vendas: {
    SELLER: EO, SUPPORT: EO, MANAGER: ET, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: ET, STOCK: N, PURCHASING: N, FINANCE: VA, FISCAL: VA, MARKETING: VA, CUSTOMER: N,
  },
  negocios: {
    SELLER: EO, SUPPORT: VO, MANAGER: ET, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: ET, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: VT, CUSTOMER: N,
  },
  prospeccoes: {
    SELLER: EO, SUPPORT: VO, MANAGER: ET, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: ET, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: VT, CUSTOMER: N,
  },
  agenda: {
    SELLER: EO, SUPPORT: VO, MANAGER: VT, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: VT, STOCK: EO, PURCHASING: EO, FINANCE: EO, FISCAL: EO, MARKETING: EO, CUSTOMER: N,
  },
  social: {
    SELLER: EA, SUPPORT: EA, MANAGER: EA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: EA, STOCK: EA, PURCHASING: EA, FINANCE: EA, FISCAL: EA, MARKETING: EA, CUSTOMER: N,
  },
  ia: {
    SELLER: VO, SUPPORT: N, MANAGER: VT, ADMIN: VA, MEDIATOR: VA,
    SALES_MANAGER: VT, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: VT, CUSTOMER: N,
  },
  perfil: {
    SELLER: N, SUPPORT: N, MANAGER: N, ADMIN: N, MEDIATOR: EA,
    SALES_MANAGER: N, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: N, CUSTOMER: N,
  },
  config: {
    SELLER: N, SUPPORT: N, MANAGER: VT, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: VT, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: N, CUSTOMER: N,
  },
  activityLogs: {
    SELLER: VO, SUPPORT: N, MANAGER: VT, ADMIN: VA, MEDIATOR: VA,
    SALES_MANAGER: VT, STOCK: VO, PURCHASING: VO, FINANCE: VO, FISCAL: VO, MARKETING: VO, CUSTOMER: N,
  },

  // ---- ERP ----
  painel: {
    SELLER: VO, SUPPORT: VO, MANAGER: VA, ADMIN: VA, MEDIATOR: VA,
    SALES_MANAGER: VA, STOCK: VA, PURCHASING: VA, FINANCE: VA, FISCAL: VA, MARKETING: VA, CUSTOMER: N,
  },
  produtos: {
    SELLER: VA, SUPPORT: VA, MANAGER: EA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: VA, STOCK: EA, PURCHASING: EA, FINANCE: VA, FISCAL: EA, MARKETING: VA, CUSTOMER: N,
  },
  estoque: {
    SELLER: VA, SUPPORT: VA, MANAGER: VA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: VA, STOCK: EA, PURCHASING: VA, FINANCE: N, FISCAL: VA, MARKETING: N, CUSTOMER: N,
  },
  pedidos: {
    SELLER: EO, SUPPORT: VO, MANAGER: EA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: EA, STOCK: VA, PURCHASING: N, FINANCE: VA, FISCAL: VA, MARKETING: N, CUSTOMER: N,
  },
  expedicao: {
    SELLER: N, SUPPORT: N, MANAGER: VA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: VA, STOCK: EA, PURCHASING: N, FINANCE: N, FISCAL: VA, MARKETING: N, CUSTOMER: N,
  },
  compras: {
    SELLER: N, SUPPORT: N, MANAGER: EA, ADMIN: VA, MEDIATOR: EA,
    SALES_MANAGER: N, STOCK: VA, PURCHASING: EA, FINANCE: VA, FISCAL: VA, MARKETING: N, CUSTOMER: N,
  },
  fiscal: {
    SELLER: N, SUPPORT: N, MANAGER: VA, ADMIN: N, MEDIATOR: EA,
    SALES_MANAGER: N, STOCK: N, PURCHASING: N, FINANCE: VA, FISCAL: EA, MARKETING: N, CUSTOMER: N,
  },
  financeiro: {
    SELLER: N, SUPPORT: N, MANAGER: EA, ADMIN: N, MEDIATOR: EA,
    SALES_MANAGER: N, STOCK: N, PURCHASING: N, FINANCE: EA, FISCAL: VA, MARKETING: N, CUSTOMER: N,
  },
  programacao: {
    SELLER: EO, SUPPORT: VO, MANAGER: VA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: EA, STOCK: VA, PURCHASING: VA, FINANCE: N, FISCAL: N, MARKETING: N, CUSTOMER: N,
  },
  mercadolivre: {
    SELLER: N, SUPPORT: N, MANAGER: VA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: VA, STOCK: EA, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: VA, CUSTOMER: N,
  },
  // Caixas de e-mail: "own" = só as caixas próprias e as compartilhadas
  // explicitamente com o usuário (MailAccountAccess). Nem Admin lê caixa
  // alheia sem compartilhamento — só cadastra/gerencia a configuração.
  emails: {
    SELLER: EO, SUPPORT: EO, MANAGER: EO, ADMIN: EO, MEDIATOR: EO,
    SALES_MANAGER: EO, STOCK: EO, PURCHASING: EO, FINANCE: EO, FISCAL: EO, MARKETING: EO, CUSTOMER: N,
  },
  relatorios: {
    SELLER: VO, SUPPORT: N, MANAGER: VA, ADMIN: VA, MEDIATOR: VA,
    SALES_MANAGER: VA, STOCK: VA, PURCHASING: VA, FINANCE: VA, FISCAL: VA, MARKETING: VA, CUSTOMER: N,
  },
  empresas: {
    SELLER: N, SUPPORT: N, MANAGER: VA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: N, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: N, CUSTOMER: N,
  },
  portalAdmin: {
    SELLER: N, SUPPORT: N, MANAGER: EA, ADMIN: EA, MEDIATOR: EA,
    SALES_MANAGER: EA, STOCK: N, PURCHASING: N, FINANCE: N, FISCAL: N, MARKETING: N, CUSTOMER: N,
  },
};

export function getPermission(role: Role, mod: Module): Permission {
  // Fail closed for any role the matrix doesn't know (e.g. a stale token).
  return MATRIX[mod][role] ?? N;
}

/** Read-only snapshot for display (e.g. the Config page's permission reference table). */
export function getPermissionMatrix(): Record<Module, Record<Role, Permission>> {
  return MATRIX;
}

export function canView(role: Role, mod: Module): boolean {
  return getPermission(role, mod).level !== "none";
}

export function canEdit(role: Role, mod: Module): boolean {
  return getPermission(role, mod).level === "edit";
}

/** Cross-profile scopes ("team"/"all") are the only ones that see other users' data. */
export function seesOtherUsers(role: Role, mod: Module): boolean {
  const scope = getPermission(role, mod).scope;
  return scope === "team" || scope === "all";
}

/** Who decides a "tornar cliente ativo" request from Prospecções: the
 * Diretor (MANAGER role, labeled "Diretor" in the UI) is the one meant to
 * approve/recusar day to day; Mediador keeps its usual blanket access on
 * top, same as every other module. */
export function canApproveClients(role: Role): boolean {
  return role === "MEDIATOR" || role === "MANAGER";
}

/** Aprovação comercial de pedidos/cotações (§3, §4.6): Gerente comercial e
 * Diretoria, mais o Mediador. */
export function canApproveOrders(role: Role): boolean {
  return role === "MEDIATOR" || role === "MANAGER" || role === "SALES_MANAGER";
}

/** Quem altera preço de venda/preço mínimo. Estoque e Fiscal editam o
 * cadastro do produto, mas não valores (§3: "funcionários do estoque não
 * alteram valores financeiros sem permissão explícita"). */
export function canEditPrices(role: Role): boolean {
  return role === "MEDIATOR" || role === "MANAGER" || role === "ADMIN" || role === "SALES_MANAGER";
}

/** Custo de produto: os mesmos de preço, mais Compras. */
export function canEditCosts(role: Role): boolean {
  return canEditPrices(role) || role === "PURCHASING";
}

/** Custos internos e margens nunca aparecem para vendedor/suporte/marketing. */
export function canSeeCosts(role: Role): boolean {
  return canEditCosts(role) || role === "FINANCE" || role === "FISCAL";
}

/** Aprovação de contas a pagar: Diretoria e Mediador. */
export function canApprovePayables(role: Role): boolean {
  return role === "MEDIATOR" || role === "MANAGER";
}

/** Visão consolidada entre empresas (§2): só Diretoria e Mediador. */
export function canSeeConsolidated(role: Role): boolean {
  return role === "MEDIATOR" || role === "MANAGER";
}

/** Página inicial de cada perfil — perfis operacionais sem acesso ao CRM
 * caem direto no Painel do ERP em vez de ficarem presos num redirect. */
export function landingFor(role: Role): string {
  if (role === "CUSTOMER") return "/portal";
  return canView(role, "analitica") ? "/" : "/painel";
}

export const ROLE_LABELS: Record<Role, string> = {
  SELLER: "Vendedor",
  SUPPORT: "Suporte",
  MANAGER: "Diretor",
  ADMIN: "Admin",
  MEDIATOR: "Mediador",
  SALES_MANAGER: "Gerente comercial",
  STOCK: "Estoque/expedição",
  PURCHASING: "Compras/importação",
  FINANCE: "Financeiro",
  FISCAL: "Fiscal",
  MARKETING: "Marketing",
  CUSTOMER: "Cliente",
};
