import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEdit } from "@/lib/permissions";
import { userHasCompany } from "@/lib/erp/company";
import { exchangeCode, verifyState } from "@/lib/erp/mercadolivre";
import { logActivity } from "@/lib/activity-log";

/** Retorno do OAuth do Mercado Livre. Exige sessão interna com edição no
 * módulo, state assinado emitido para o mesmo usuário e acesso à empresa. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/mercado-livre?${q}`, url.origin));

  const session = await auth();
  if (!session?.user || session.user.role === "CUSTOMER") return NextResponse.redirect(new URL("/login", url.origin));
  if (!canEdit(session.user.role, "mercadolivre")) return back("erro=" + encodeURIComponent("Sem permissão para conectar o Mercado Livre."));

  const code = url.searchParams.get("code");
  const state = verifyState(url.searchParams.get("state") ?? "");
  if (!code || !state || state.userId !== session.user.id) {
    return back("erro=" + encodeURIComponent("Retorno do Mercado Livre inválido ou expirado. Tente conectar de novo."));
  }
  if (!(await userHasCompany(session, state.companyId))) {
    return back("erro=" + encodeURIComponent("Empresa não permitida para o seu usuário."));
  }
  try {
    await exchangeCode(state.companyId, code);
    await logActivity({
      actorId: session.user.id,
      entityType: "Integration",
      entityId: state.companyId,
      action: "updated",
      diff: { mercadoLivre: "conta conectada" },
      companyId: state.companyId,
    });
    return back("conectado=1");
  } catch (e) {
    return back("erro=" + encodeURIComponent(e instanceof Error ? e.message : "Falha ao conectar."));
  }
}
