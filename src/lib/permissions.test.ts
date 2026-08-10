import { describe, expect, it } from "vitest";
import { canApproveClients, canEdit, canView, getPermission, seesOtherUsers } from "./permissions";

describe("permissions", () => {
  describe("getPermission / canView / canEdit", () => {
    it("SELLER edits their own Vendas records but can't touch Perfil", () => {
      expect(canEdit("SELLER", "vendas")).toBe(true);
      expect(getPermission("SELLER", "vendas").scope).toBe("own");
      expect(canView("SELLER", "perfil")).toBe(false);
      expect(canEdit("SELLER", "perfil")).toBe(false);
    });

    it("SUPPORT can view Negócios but not edit it", () => {
      expect(canView("SUPPORT", "negocios")).toBe(true);
      expect(canEdit("SUPPORT", "negocios")).toBe(false);
    });

    it("MEDIATOR has edit·all on every module that has an edit concept", () => {
      const modules = ["analitica", "vendas", "negocios", "prospeccoes", "agenda", "social", "perfil", "config"] as const;
      for (const mod of modules) {
        expect(getPermission("MEDIATOR", mod)).toEqual({ level: "edit", scope: "all" });
      }
    });

    it("MANAGER (Diretor) gets team-wide edit on the core sales modules", () => {
      for (const mod of ["vendas", "negocios", "prospeccoes"] as const) {
        expect(getPermission("MANAGER", mod)).toEqual({ level: "edit", scope: "team" });
      }
    });

    it("only MEDIATOR can touch Perfil", () => {
      for (const role of ["SELLER", "SUPPORT", "MANAGER", "ADMIN"] as const) {
        expect(canView(role, "perfil")).toBe(false);
      }
      expect(canEdit("MEDIATOR", "perfil")).toBe(true);
    });
  });

  describe("seesOtherUsers", () => {
    it("is false for own-scoped access", () => {
      expect(seesOtherUsers("SELLER", "vendas")).toBe(false);
    });

    it("is true for team/all scoped access", () => {
      expect(seesOtherUsers("MANAGER", "vendas")).toBe(true);
      expect(seesOtherUsers("MEDIATOR", "vendas")).toBe(true);
    });

    it("is false when there's no access at all", () => {
      expect(seesOtherUsers("SELLER", "perfil")).toBe(false);
    });
  });

  describe("canApproveClients", () => {
    it("allows MEDIATOR and MANAGER (Diretor) only", () => {
      expect(canApproveClients("MEDIATOR")).toBe(true);
      expect(canApproveClients("MANAGER")).toBe(true);
    });

    it("rejects SELLER, SUPPORT, and ADMIN", () => {
      expect(canApproveClients("SELLER")).toBe(false);
      expect(canApproveClients("SUPPORT")).toBe(false);
      expect(canApproveClients("ADMIN")).toBe(false);
    });
  });
});
