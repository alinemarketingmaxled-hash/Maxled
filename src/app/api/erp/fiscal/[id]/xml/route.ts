import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canView } from "@/lib/permissions";
import { listUserCompanies } from "@/lib/erp/company";

/** Download do XML autorizado. Equipe: precisa ver o módulo Fiscal e ter
 * vínculo com a empresa da nota (não depende da empresa ativa no cookie,
 * para links abertos depois continuarem seguros). Cliente do portal: só
 * notas autorizadas de pedidos do próprio cadastro. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Não autenticado", { status: 401 });
  const { id } = await ctx.params;

  const doc = await prisma.fiscalDocument.findUnique({
    where: { id },
    select: { companyId: true, status: true, xml: true, accessKey: true, number: true, order: { select: { contactId: true } } },
  });
  // Mesma resposta para "não existe" e "não é seu": não revela ids alheios.
  const notFound = () => new Response("Documento não encontrado", { status: 404 });
  if (!doc) return notFound();

  if (session.user.role === "CUSTOMER") {
    if (!session.user.contactId || doc.order.contactId !== session.user.contactId || doc.status !== "AUTORIZADA") {
      return notFound();
    }
  } else {
    if (!canView(session.user.role, "fiscal")) return new Response("Sem permissão", { status: 403 });
    const companies = await listUserCompanies(session);
    if (!companies.some((c) => c.id === doc.companyId)) return notFound();
  }

  if (!doc.xml || (doc.status !== "AUTORIZADA" && doc.status !== "CANCELADA")) {
    return new Response("XML indisponível para esta nota", { status: 409 });
  }

  const filename = `${doc.accessKey ?? `nfe-${doc.number}`}-nfe.xml`;
  return new Response(doc.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
