"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireEditAction } from "@/lib/require-permission";
import { logActivity } from "@/lib/activity-log";
import { runAction, str, type ActionResult } from "@/lib/erp/action-result";

const MIN_PASSWORD = 8;

function checkPassword(pw: string | null): string {
  if (!pw || pw.length < MIN_PASSWORD) throw new Error(`A senha temporária precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
  if (pw.length > 128) throw new Error("Senha muito longa.");
  return pw;
}

export async function searchPortalContacts(q: string) {
  await requireEditAction("portalAdmin");
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const contacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { accountName: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { cnpj: { contains: term } },
        ...(digits.length >= 3 ? [{ cnpj: { contains: digits } }] : []),
      ],
    },
    take: 15,
    orderBy: { accountName: "asc" },
    select: { id: true, firstName: true, lastName: true, accountName: true, cnpj: true, email: true },
  });
  return contacts.map((c) => ({
    id: c.id,
    label: c.accountName || `${c.firstName} ${c.lastName}`.trim(),
    detail: [c.cnpj, c.email].filter(Boolean).join(" · "),
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email ?? "",
  }));
}

export async function createPortalAccess(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("portalAdmin");
  return runAction(async () => {
    const contactId = str(fd, "contactId");
    const name = str(fd, "name");
    const email = str(fd, "email")?.toLowerCase() ?? null;
    const password = checkPassword(str(fd, "password"));
    if (!contactId) throw new Error("Selecione o cliente.");
    if (!name) throw new Error("Informe o nome de quem vai acessar.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
    const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null }, select: { id: true } });
    if (!contact) throw new Error("Cliente não encontrado.");
    const user = await prisma.portalUser.create({
      data: { contactId, name, email, passwordHash: await bcrypt.hash(password, 10), createdById: session.user.id },
    });
    await logActivity({ actorId: session.user.id, entityType: "PortalUser", entityId: user.id, action: "created", contactId, diff: { email } });
    return { ok: true, message: `Acesso criado para ${email}. Envie a senha temporária ao cliente por um canal seguro.` };
  });
}

async function loadUser(id: string | null) {
  if (!id) throw new Error("Acesso não encontrado.");
  const user = await prisma.portalUser.findUnique({ where: { id }, select: { id: true, active: true, contactId: true } });
  if (!user) throw new Error("Acesso não encontrado.");
  return user;
}

export async function togglePortalAccess(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("portalAdmin");
  return runAction(async () => {
    const user = await loadUser(str(fd, "id"));
    await prisma.portalUser.update({ where: { id: user.id }, data: { active: !user.active } });
    await logActivity({
      actorId: session.user.id, entityType: "PortalUser", entityId: user.id, action: "access_changed",
      contactId: user.contactId, diff: { active: !user.active },
    });
  });
}

export async function unlockPortalAccess(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("portalAdmin");
  return runAction(async () => {
    const user = await loadUser(str(fd, "id"));
    await prisma.portalUser.update({ where: { id: user.id }, data: { lockedAt: null, failedLoginAttempts: 0 } });
    await logActivity({ actorId: session.user.id, entityType: "PortalUser", entityId: user.id, action: "unlocked", contactId: user.contactId });
  });
}

export async function resetPortalPassword(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("portalAdmin");
  return runAction(async () => {
    const user = await loadUser(str(fd, "id"));
    // Vem do prompt do ActionButton como "reason".
    const password = checkPassword(str(fd, "reason"));
    await prisma.portalUser.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10), lockedAt: null, failedLoginAttempts: 0 },
    });
    await logActivity({ actorId: session.user.id, entityType: "PortalUser", entityId: user.id, action: "access_changed", contactId: user.contactId, diff: { passwordReset: true } });
    return { ok: true, message: "Senha redefinida." };
  });
}

export async function respondPortalRequest(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("portalAdmin");
  return runAction(async () => {
    const id = str(fd, "id");
    const response = str(fd, "response");
    if (!id) throw new Error("Solicitação não encontrada.");
    if (!response) throw new Error("Escreva a resposta ao cliente.");
    const res = await prisma.portalRequest.updateMany({
      where: { id, status: "ABERTA" },
      data: { status: "RESOLVIDA", response, resolvedById: session.user.id, resolvedAt: new Date() },
    });
    if (res.count !== 1) throw new Error("Solicitação já respondida.");
    const req = await prisma.portalRequest.findUnique({ where: { id }, select: { contactId: true } });
    await logActivity({ actorId: session.user.id, entityType: "PortalRequest", entityId: id, action: "updated", contactId: req?.contactId, diff: { resolved: true } });
    return { ok: true, message: "Resposta enviada." };
  });
}
