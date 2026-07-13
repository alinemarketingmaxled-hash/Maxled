import type { Role } from "@/generated/prisma/client";

export type Module =
  | "analitica"
  | "vendas"
  | "negocios"
  | "agenda"
  | "social"
  | "ia"
  | "perfil"
  | "config"
  | "activityLogs";

export type Level = "none" | "view" | "edit";
export type Scope = "none" | "own" | "team" | "all";

export type Permission = { level: Level; scope: Scope };

/**
 * Mirrors the access matrix in docs/CRM-SPEC.md §6. "own" means a user only
 * ever sees their own records; "team" aggregates across users (Manager+);
 * "all" is the cross-profile view reserved for Admin/Mediador.
 */
const MATRIX: Record<Module, Record<Role, Permission>> = {
  analitica: {
    SELLER: { level: "edit", scope: "own" },
    SUPPORT: { level: "view", scope: "own" },
    MANAGER: { level: "edit", scope: "team" },
    ADMIN: { level: "edit", scope: "all" },
    MEDIATOR: { level: "edit", scope: "all" },
  },
  vendas: {
    SELLER: { level: "edit", scope: "own" },
    SUPPORT: { level: "edit", scope: "own" },
    MANAGER: { level: "edit", scope: "team" },
    ADMIN: { level: "edit", scope: "all" },
    MEDIATOR: { level: "edit", scope: "all" },
  },
  negocios: {
    SELLER: { level: "edit", scope: "own" },
    SUPPORT: { level: "view", scope: "own" },
    MANAGER: { level: "edit", scope: "team" },
    ADMIN: { level: "edit", scope: "all" },
    MEDIATOR: { level: "edit", scope: "all" },
  },
  agenda: {
    SELLER: { level: "edit", scope: "own" },
    SUPPORT: { level: "view", scope: "own" },
    MANAGER: { level: "view", scope: "team" },
    ADMIN: { level: "edit", scope: "all" },
    MEDIATOR: { level: "edit", scope: "all" },
  },
  social: {
    SELLER: { level: "edit", scope: "all" },
    SUPPORT: { level: "edit", scope: "all" },
    MANAGER: { level: "edit", scope: "all" },
    ADMIN: { level: "edit", scope: "all" },
    MEDIATOR: { level: "edit", scope: "all" },
  },
  ia: {
    SELLER: { level: "view", scope: "own" },
    SUPPORT: { level: "none", scope: "none" },
    MANAGER: { level: "view", scope: "team" },
    ADMIN: { level: "view", scope: "all" },
    MEDIATOR: { level: "view", scope: "all" },
  },
  perfil: {
    SELLER: { level: "none", scope: "none" },
    SUPPORT: { level: "none", scope: "none" },
    MANAGER: { level: "none", scope: "none" },
    ADMIN: { level: "none", scope: "none" },
    MEDIATOR: { level: "edit", scope: "all" },
  },
  config: {
    SELLER: { level: "none", scope: "none" },
    SUPPORT: { level: "none", scope: "none" },
    MANAGER: { level: "view", scope: "team" },
    ADMIN: { level: "edit", scope: "all" },
    MEDIATOR: { level: "edit", scope: "all" },
  },
  activityLogs: {
    SELLER: { level: "view", scope: "own" },
    SUPPORT: { level: "none", scope: "none" },
    MANAGER: { level: "view", scope: "team" },
    ADMIN: { level: "view", scope: "all" },
    MEDIATOR: { level: "view", scope: "all" },
  },
};

export function getPermission(role: Role, mod: Module): Permission {
  return MATRIX[mod][role];
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
