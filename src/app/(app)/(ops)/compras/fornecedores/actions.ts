"use server";

import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, int, type ActionResult } from "@/lib/erp/action-result";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

function readSupplier(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Informe o nome do fornecedor.");
  const rating = int(fd, "rating");
  return {
    name,
    tradeName: str(fd, "tradeName"),
    document: str(fd, "document"),
    country: str(fd, "country") ?? "Brasil",
    currency: (str(fd, "currency") ?? "BRL").toUpperCase().slice(0, 3),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    contactName: str(fd, "contactName"),
    address: str(fd, "address"),
    paymentTerms: str(fd, "paymentTerms"),
    leadTimeDays: int(fd, "leadTimeDays"),
    rating: rating === null ? null : Math.min(5, Math.max(1, rating)),
    notes: str(fd, "notes"),
  };
}

export async function createSupplierAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("compras");
  return runAction(async () => {
    const companyId = await activeCompanyId(session);
    const s = await prisma.supplier.create({ data: { ...readSupplier(fd), companyId } });
    await logActivity({ actorId: session.user.id, entityType: "Supplier", entityId: s.id, action: "created", companyId });
    return { ok: true, redirectTo: `/compras/fornecedores/${s.id}` };
  });
}

export async function updateSupplierAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("compras");
  return runAction(async () => {
    const companyId = await activeCompanyId(session);
    const id = str(fd, "id") ?? "";
    const res = await prisma.supplier.updateMany({ where: { id, companyId, deletedAt: null }, data: readSupplier(fd) });
    if (res.count !== 1) throw new Error("Fornecedor não encontrado.");
    await logActivity({ actorId: session.user.id, entityType: "Supplier", entityId: id, action: "updated", companyId });
    return { ok: true, message: "Fornecedor atualizado." };
  });
}

export async function deleteSupplierAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("compras");
  return runAction(async () => {
    const companyId = await activeCompanyId(session);
    const id = str(fd, "id") ?? "";
    const open = await prisma.purchaseOrder.count({
      where: { supplierId: id, companyId, status: { in: ["SOLICITADO", "COTACAO", "APROVADO", "RECEBIDO_PARCIAL"] } },
    });
    if (open > 0) throw new Error("Fornecedor tem compras em andamento.");
    const res = await prisma.supplier.updateMany({ where: { id, companyId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (res.count !== 1) throw new Error("Fornecedor não encontrado.");
    await logActivity({ actorId: session.user.id, entityType: "Supplier", entityId: id, action: "deleted", companyId });
    return { ok: true, redirectTo: "/compras/fornecedores" };
  });
}
