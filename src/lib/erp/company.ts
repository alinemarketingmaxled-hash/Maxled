import "server-only";
import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { canSeeConsolidated } from "@/lib/permissions";
import type { Company } from "@/generated/prisma/client";

export const COMPANY_COOKIE = "maxled_company";

export type CompanyContext = {
  companies: Pick<Company, "id" | "code" | "name" | "tradeName">[];
  active: Pick<Company, "id" | "code" | "name" | "tradeName">;
};

/** Empresas que o usuário pode operar: vínculos em UserCompany; o Mediador
 * enxerga todas as ativas. */
export async function listUserCompanies(session: Session) {
  const select = { id: true, code: true, name: true, tradeName: true } as const;
  if (session.user.role === "MEDIATOR") {
    return prisma.company.findMany({ where: { active: true }, orderBy: { code: "asc" }, select });
  }
  return prisma.company.findMany({
    where: { active: true, users: { some: { userId: session.user.id } } },
    orderBy: { code: "asc" },
    select,
  });
}

/** Resolve a empresa ativa a partir do cookie, sempre revalidando o vínculo
 * no servidor — um cookie adulterado com o id de outra empresa cai de volta
 * na primeira empresa permitida. Lança se o usuário não tiver nenhuma. */
export async function getCompanyContext(session: Session): Promise<CompanyContext> {
  const companies = await listUserCompanies(session);
  if (companies.length === 0) {
    throw new Error("Seu usuário não está vinculado a nenhuma empresa. Peça acesso ao administrador.");
  }
  const jar = await cookies();
  const wanted = jar.get(COMPANY_COOKIE)?.value;
  const active = companies.find((c) => c.id === wanted) ?? companies[0];
  return { companies, active };
}

/** Atalho para páginas/ações: só o id da empresa ativa. */
export async function activeCompanyId(session: Session): Promise<string> {
  return (await getCompanyContext(session)).active.id;
}

/** Empresas sobre as quais um relatório/painel consolida. "todas" só vale
 * para Diretoria/Mediador e só entre empresas que eles já acessam; os
 * registros continuam separados — apenas os totais são somados. */
export async function resolveCompanyScope(session: Session, param: string | undefined) {
  const ctx = await getCompanyContext(session);
  const consolidated = param === "todas" && canSeeConsolidated(session.user.role) && ctx.companies.length > 1;
  return {
    ctx,
    consolidated,
    companyIds: consolidated ? ctx.companies.map((c) => c.id) : [ctx.active.id],
    canConsolidate: canSeeConsolidated(session.user.role) && ctx.companies.length > 1,
  };
}

export async function userHasCompany(session: Session, companyId: string) {
  const companies = await listUserCompanies(session);
  return companies.some((c) => c.id === companyId);
}
