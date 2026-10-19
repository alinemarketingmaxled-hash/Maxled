"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { COMPANY_COOKIE, userHasCompany } from "@/lib/erp/company";

/** Troca a empresa ativa. O vínculo é validado aqui; as páginas revalidam
 * de novo a cada leitura (getCompanyContext), então o cookie sozinho nunca
 * dá acesso a outra empresa. */
export async function setActiveCompany(companyId: string) {
  const session = await auth();
  if (!session?.user || session.user.role === "CUSTOMER") redirect("/login");
  if (!(await userHasCompany(session, companyId))) throw new Error("Empresa não permitida para o seu usuário.");
  const jar = await cookies();
  jar.set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // Limpa todo o cache de navegação do cliente (staleTimes de 30s em
  // next.config): nenhuma tela já visitada pode reaparecer com dados da
  // empresa anterior.
  revalidatePath("/", "layout");
}
