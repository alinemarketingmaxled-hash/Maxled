"use server";

import { requireEditAction, requireViewAction } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, num, int, bool, type ActionResult } from "@/lib/erp/action-result";
import { advanceShipping, registerReturn, registerShippingIssue, type ShippingStep } from "@/lib/erp/orders";

const STEPS: ShippingStep[] = ["start_picking", "picked", "checked", "dispatch", "delivered"];

export async function advanceShippingAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("expedicao");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const step = str(fd, "step") as ShippingStep | null;
    if (!step || !STEPS.includes(step)) throw new Error("Etapa inválida.");
    await advanceShipping(session, companyId, str(fd, "orderId") ?? "", step, {
      packages: int(fd, "packages"),
      grossWeightKg: num(fd, "grossWeightKg"),
      dimensions: str(fd, "dimensions"),
      carrier: str(fd, "carrier"),
      shippingMode: str(fd, "shippingMode"),
      freightPayer: str(fd, "freightPayer"),
      trackingCode: str(fd, "trackingCode"),
    });
    return { ok: true, message: "Etapa registrada." };
  });
}

export async function shippingIssueAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("expedicao");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const issue = str(fd, "issue") ?? str(fd, "reason");
    if (!issue) throw new Error("Descreva a ocorrência.");
    await registerShippingIssue(session, companyId, str(fd, "orderId") ?? "", issue);
    return { ok: true, message: "Ocorrência registrada." };
  });
}

/** Devolução: Expedição ou Estoque (a checagem fina fica em registerReturn). */
export async function returnAction(fd: FormData): Promise<ActionResult> {
  const session = await requireViewAction("expedicao");
  if (!canEdit(session.user.role, "expedicao") && !canEdit(session.user.role, "estoque")) {
    return { ok: false, error: "Sem permissão para registrar devoluções." };
  }
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const quantity = int(fd, "quantity");
    if (!quantity || quantity <= 0) throw new Error("Informe a quantidade.");
    const reason = str(fd, "reason");
    if (!reason) throw new Error("Informe o motivo.");
    await registerReturn(session, companyId, str(fd, "orderId") ?? "", {
      productId: str(fd, "productId") ?? "",
      quantity,
      damaged: bool(fd, "damaged"),
      reason,
      requestKey: str(fd, "requestKey") ?? "",
    });
    return { ok: true, message: "Devolução registrada no estoque." };
  });
}
