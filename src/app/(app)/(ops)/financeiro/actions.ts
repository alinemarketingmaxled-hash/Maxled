"use server";

import { requireEditAction, requireViewAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { date, num, runAction, str, type ActionResult } from "@/lib/erp/action-result";
import {
  approvePayable,
  cancelPayable,
  createPayable,
  registerPayablePayment,
  registerReceivablePayment,
  toggleReconciled,
} from "@/lib/erp/finance";

function paymentInput(fd: FormData) {
  const amount = num(fd, "amount");
  if (amount === null) throw new Error("Informe o valor.");
  return {
    amount,
    paidAt: date(fd, "paidAt") ?? new Date(),
    method: str(fd, "method"),
    notes: str(fd, "notes"),
    requestKey: str(fd, "requestKey") ?? "",
  };
}

export async function payReceivableAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("financeiro");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const id = str(fd, "id");
    if (!id) throw new Error("Título não informado.");
    await registerReceivablePayment(session, companyId, id, paymentInput(fd));
    return { ok: true, message: "Recebimento registrado." };
  });
}

export async function createPayableAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("financeiro");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const amount = num(fd, "amount");
    const dueDate = date(fd, "dueDate");
    if (amount === null) throw new Error("Informe o valor.");
    if (!dueDate) throw new Error("Informe o vencimento.");
    const attachmentUrl = str(fd, "attachmentUrl");
    if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl)) throw new Error("O comprovante deve ser um link http(s).");
    await createPayable(session, companyId, {
      supplierId: str(fd, "supplierId"),
      description: str(fd, "description") ?? "",
      category: str(fd, "category") ?? "Outros",
      documentNumber: str(fd, "documentNumber"),
      amount,
      dueDate,
      notes: str(fd, "notes"),
      attachmentUrl,
    });
    return { ok: true, message: "Conta lançada. Aguarda aprovação da diretoria." };
  });
}

/** Aprovação é da Diretoria, que pode não ter edição no Financeiro: aqui só
 * exige visualização; a regra de quem aprova fica em approvePayable. */
export async function approvePayableAction(fd: FormData): Promise<ActionResult> {
  const session = await requireViewAction("financeiro");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const id = str(fd, "id");
    if (!id) throw new Error("Conta não informada.");
    await approvePayable(session, companyId, id);
    return { ok: true, message: "Conta aprovada." };
  });
}

export async function payPayableAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("financeiro");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const id = str(fd, "id");
    if (!id) throw new Error("Conta não informada.");
    await registerPayablePayment(session, companyId, id, paymentInput(fd));
    return { ok: true, message: "Pagamento registrado." };
  });
}

export async function cancelPayableAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("financeiro");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const id = str(fd, "id");
    if (!id) throw new Error("Conta não informada.");
    await cancelPayable(session, companyId, id);
    return { ok: true, message: "Conta cancelada." };
  });
}

export async function toggleReconciledAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("financeiro");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const kind = str(fd, "kind");
    const id = str(fd, "id");
    if ((kind !== "receivable" && kind !== "payable") || !id) throw new Error("Pagamento inválido.");
    await toggleReconciled(session, companyId, kind, id);
  });
}
