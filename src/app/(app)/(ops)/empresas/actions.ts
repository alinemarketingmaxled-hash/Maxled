"use server";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireEditAction } from "@/lib/require-permission";
import { runAction, str, num, int, bool, type ActionResult } from "@/lib/erp/action-result";
import type { FiscalEnvironment } from "@/generated/prisma/client";
import { UFS } from "@/components/erp/empresas/ufs";

const AUDITED = [
  "code", "name", "tradeName", "cnpj", "stateRegistration", "taxRegime", "street", "number", "district", "city",
  "state", "postalCode", "phone", "email", "description", "active", "maxDiscountPct", "approvalAmountLimit", "allowNegativeStock",
  "fiscalEnvironment", "fiscalProvider", "fiscalSeries", "nextFiscalNumber",
] as const;

export async function saveCompanyAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("empresas");
  return runAction(async () => {
    const id = str(fd, "id");
    const code = (str(fd, "code") ?? "").toUpperCase();
    const name = str(fd, "name");
    if (!/^[A-Z0-9]{1,10}$/.test(code)) throw new Error("Código deve ter de 1 a 10 letras/números.");
    if (!name) throw new Error("Informe a razão social.");
    const state = str(fd, "state");
    if (state && !UFS.includes(state)) throw new Error("UF inválida.");
    const cnpj = str(fd, "cnpj");
    if (cnpj && cnpj.replace(/\D/g, "").length !== 14) throw new Error("CNPJ deve ter 14 dígitos.");

    const fiscalEnvironment: FiscalEnvironment = str(fd, "fiscalEnvironment") === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO";
    const fiscalProvider = str(fd, "fiscalProvider") ?? "simulador";
    if (fiscalEnvironment === "PRODUCAO" && fiscalProvider === "simulador") {
      throw new Error("O simulador só opera em homologação. Integre o provedor fiscal real antes de mudar para produção.");
    }
    const maxDiscountPct = num(fd, "maxDiscountPct") ?? 0;
    if (maxDiscountPct < 0 || maxDiscountPct > 100) throw new Error("Desconto máximo deve estar entre 0 e 100%.");
    const approvalAmountLimit = num(fd, "approvalAmountLimit");
    if (approvalAmountLimit !== null && approvalAmountLimit < 0) throw new Error("Teto de aprovação inválido.");
    const fiscalSeries = int(fd, "fiscalSeries") ?? 1;
    if (fiscalSeries < 0 || fiscalSeries > 999) throw new Error("Série fiscal deve estar entre 0 e 999.");

    const data = {
      code,
      name,
      tradeName: str(fd, "tradeName"),
      cnpj,
      stateRegistration: str(fd, "stateRegistration"),
      taxRegime: str(fd, "taxRegime"),
      street: str(fd, "street"),
      number: str(fd, "number"),
      district: str(fd, "district"),
      city: str(fd, "city"),
      state,
      postalCode: str(fd, "postalCode"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      description: str(fd, "description"),
      active: bool(fd, "active"),
      maxDiscountPct,
      approvalAmountLimit,
      allowNegativeStock: bool(fd, "allowNegativeStock"),
      fiscalEnvironment,
      fiscalProvider,
      fiscalSeries,
    };

    // Numeração fiscal: só o Mediador ajusta, e só com confirmação explícita
    // (pular ou repetir números gera inutilização/rejeição na SEFAZ).
    const nextFiscalNumber = int(fd, "nextFiscalNumber");
    const changeNumber =
      session.user.role === "MEDIATOR" && bool(fd, "confirmNextFiscalNumber") && nextFiscalNumber !== null && nextFiscalNumber >= 1;

    if (id) {
      const before = await prisma.company.findUnique({ where: { id } });
      if (!before) throw new Error("Empresa não encontrada.");
      if (!data.active) {
        const others = await prisma.company.count({ where: { active: true, id: { not: id } } });
        if (others === 0) throw new Error("É preciso manter ao menos uma empresa ativa.");
      }
      const update = { ...data, ...(changeNumber ? { nextFiscalNumber: nextFiscalNumber! } : {}) };
      const after = await prisma.company.update({ where: { id }, data: update });
      const diff: Record<string, { de: string | null; para: string | null }> = {};
      for (const k of AUDITED) {
        const a = before[k] === null || before[k] === undefined ? null : String(before[k]);
        const b = after[k] === null || after[k] === undefined ? null : String(after[k]);
        if (a !== b) diff[k] = { de: a, para: b };
      }
      if (Object.keys(diff).length > 0) {
        await logActivity({ actorId: session.user.id, entityType: "Company", entityId: id, action: "updated", diff, companyId: id });
      }
      return { ok: true, message: "Empresa salva." };
    }

    const created = await prisma.company.create({
      data: { ...data, ...(changeNumber ? { nextFiscalNumber: nextFiscalNumber! } : {}) },
    });
    // Quem cria a empresa já passa a operá-la.
    if (session.user.role !== "MEDIATOR") {
      await prisma.userCompany.create({ data: { userId: session.user.id, companyId: created.id } });
    }
    await logActivity({ actorId: session.user.id, entityType: "Company", entityId: created.id, action: "created", companyId: created.id });
    return { ok: true, message: "Empresa criada.", redirectTo: `/empresas/${created.id}` };
  });
}

/** Substitui as empresas que um usuário pode operar. */
export async function setUserCompaniesAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("empresas");
  return runAction(async () => {
    const userId = str(fd, "userId");
    if (!userId) throw new Error("Usuário inválido.");
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, name: true } });
    if (!user) throw new Error("Usuário não encontrado.");
    const wanted = fd.getAll("companyIds").filter((v): v is string => typeof v === "string");
    const valid = await prisma.company.findMany({ where: { id: { in: wanted } }, select: { id: true, code: true } });
    const before = await prisma.userCompany.findMany({ where: { userId }, select: { company: { select: { code: true } } } });

    await prisma.$transaction([
      prisma.userCompany.deleteMany({ where: { userId } }),
      prisma.userCompany.createMany({ data: valid.map((c) => ({ userId, companyId: c.id })) }),
    ]);
    await logActivity({
      actorId: session.user.id,
      entityType: "User",
      entityId: userId,
      action: "access_changed",
      diff: { empresasAntes: before.map((b) => b.company.code), empresasDepois: valid.map((c) => c.code) },
    });
    return { ok: true, message: `Acessos de ${user.name} atualizados.` };
  });
}
