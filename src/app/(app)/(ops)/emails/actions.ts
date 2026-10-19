"use server";

import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, int, bool, type ActionResult } from "@/lib/erp/action-result";
import {
  associateMessage,
  deleteDraft,
  saveAccount,
  saveDraft,
  sendMail,
  setAccountShare,
  testAccountConnection,
  type ComposeInput,
} from "@/lib/erp/mail";
import { syncAccountForSession } from "@/lib/erp/mail-sync";

export async function saveAccountAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("emails");
  return runAction(async () => {
    const id = str(fd, "id") ?? undefined;
    await saveAccount(
      session,
      {
        ownerId: str(fd, "ownerId"),
        emailAddress: str(fd, "emailAddress") ?? "",
        displayName: str(fd, "displayName"),
        imapHost: str(fd, "imapHost") ?? "",
        imapPort: int(fd, "imapPort") ?? 993,
        imapSecure: bool(fd, "imapSecure"),
        smtpHost: str(fd, "smtpHost") ?? "",
        smtpPort: int(fd, "smtpPort") ?? 465,
        smtpSecure: bool(fd, "smtpSecure"),
        username: str(fd, "username") ?? "",
        password: (fd.get("password") as string) || null,
        active: bool(fd, "active"),
      },
      id,
    );
    return { ok: true, message: id ? "Conta atualizada." : "Conta cadastrada." };
  });
}

export async function shareAccountAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("emails");
  return runAction(async () => {
    const userId = str(fd, "userId");
    if (!userId) return { ok: false, error: "Escolha um usuário." };
    await setAccountShare(session, str(fd, "accountId") ?? "", userId, str(fd, "share") !== "false");
  });
}

export async function testConnectionAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("emails");
  return runAction(async () => {
    const r = await testAccountConnection(session, str(fd, "accountId") ?? "");
    return r.ok ? { ok: true, message: `${r.imap} ${r.smtp}` } : { ok: false, error: `${r.imap} ${r.smtp}` };
  });
}

export async function syncAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("emails");
  return runAction(async () => {
    const r = await syncAccountForSession(session, str(fd, "accountId") ?? "");
    return { ok: true, message: r.skipped ? "Caixa desativada." : `${r.imported} mensagem(ns) sincronizada(s).` };
  });
}

function readCompose(fd: FormData, companyId: string): ComposeInput {
  const files = fd.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  return {
    accountId: str(fd, "accountId") ?? "",
    to: str(fd, "to") ?? "",
    cc: str(fd, "cc"),
    subject: str(fd, "subject") ?? "",
    body: (fd.get("body") as string) ?? "",
    contactId: str(fd, "contactId"),
    orderId: str(fd, "orderId"),
    inReplyTo: str(fd, "inReplyTo"),
    draftId: str(fd, "draftId"),
    requestKey: str(fd, "requestKey") ?? "",
    files,
    companyId,
  };
}

export async function composeAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("emails");
  return runAction(async () => {
    const input = readCompose(fd, await activeCompanyId(session).catch(() => ""));
    if (str(fd, "intent") === "draft") {
      const draft = await saveDraft(session, input);
      return { ok: true, message: "Rascunho salvo.", redirectTo: `/emails/${draft.id}` };
    }
    const { message, duplicate } = await sendMail(session, input);
    return { ok: true, message: duplicate ? "Esta mensagem já tinha sido enviada." : "E-mail enviado.", redirectTo: `/emails/${message.id}` };
  });
}

export async function associateAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("emails");
  return runAction(async () => {
    const companyId = await activeCompanyId(session);
    await associateMessage(session, companyId, str(fd, "messageId") ?? "", {
      contactId: str(fd, "contactId"),
      orderId: str(fd, "orderId"),
    });
    return { ok: true, message: "Associação atualizada." };
  });
}

export async function deleteDraftAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("emails");
  return runAction(async () => {
    await deleteDraft(session, str(fd, "messageId") ?? "");
    return { ok: true, redirectTo: "/emails?pasta=DRAFTS" };
  });
}
