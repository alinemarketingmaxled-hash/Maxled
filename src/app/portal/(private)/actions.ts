"use server";

import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCustomer, REQUEST_TYPE_LABELS } from "@/lib/erp/portal";
import { runAction, str, type ActionResult } from "@/lib/erp/action-result";

export async function portalSignOut() {
  await signOut({ redirectTo: "/portal/login" });
}

/** Solicitações do cliente (cadastro, contato, programação). Sempre gravadas
 * no contato da sessão; o requestKey do formulário evita duplicar o mesmo
 * envio num duplo clique. */
export async function createPortalRequest(fd: FormData): Promise<ActionResult> {
  const { contactId, portalUser } = await requireCustomer();
  return runAction(async () => {
    const type = str(fd, "type") ?? "";
    if (!(type in REQUEST_TYPE_LABELS)) throw new Error("Tipo de solicitação inválido.");
    const message = str(fd, "message");
    if (!message || message.length < 5) throw new Error("Descreva a solicitação.");
    if (message.length > 4000) throw new Error("Mensagem muito longa (máximo 4000 caracteres).");
    const recent = await prisma.portalRequest.findFirst({
      where: { contactId, portalUserId: portalUser.id, type, message, createdAt: { gt: new Date(Date.now() - 60_000) } },
      select: { id: true },
    });
    if (recent) return { ok: true, message: "Solicitação já registrada." };
    await prisma.portalRequest.create({ data: { contactId, portalUserId: portalUser.id, type, message } });
    return { ok: true, message: "Solicitação enviada. A equipe MAX LED vai responder por aqui." };
  });
}
