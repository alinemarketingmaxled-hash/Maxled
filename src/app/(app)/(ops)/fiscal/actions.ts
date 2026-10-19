"use server";

import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, type ActionResult } from "@/lib/erp/action-result";
import { cancelFiscalDocument, emitForOrder } from "@/lib/erp/fiscal";

export async function emitAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("fiscal");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const orderId = str(fd, "orderId");
    if (!orderId) throw new Error("Pedido não informado.");
    const doc = await emitForOrder(session, companyId, orderId);
    if (doc.status === "AUTORIZADA") return { ok: true, message: `NF-e ${doc.number} autorizada.` };
    return { ok: false, error: `NF-e rejeitada (${doc.rejectionCode}): ${doc.rejectionReason}` };
  });
}

export async function cancelAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("fiscal");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const docId = str(fd, "docId");
    if (!docId) throw new Error("Nota não informada.");
    await cancelFiscalDocument(session, companyId, docId, str(fd, "reason") ?? "");
    return { ok: true, message: "Nota cancelada." };
  });
}
