import "server-only";
import { simpleParser, type AddressObject } from "mailparser";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { findContactForAddresses, findOrderForSubject, imapClientFor, requireAccountAccess } from "@/lib/erp/mail";
import { extractAddresses, friendlyMailError, htmlToText } from "@/lib/erp/mail-utils";

const FIRST_SYNC_LIMIT = 200;
const FIRST_SYNC_DAYS = 30;
const MAX_BODY_CHARS = 200_000;

function addrText(a: AddressObject | AddressObject[] | undefined) {
  if (!a) return "";
  return (Array.isArray(a) ? a : [a]).map((x) => x.text).join(", ");
}

/** Sincroniza Entrada e Enviados de uma conta via IMAP. Busca só UIDs acima
 * do último gravado em cada pasta; o upsert em (conta, pasta, uid) torna a
 * sincronização repetível sem duplicar mensagens. */
export async function syncAccount(accountId: string) {
  const account = await prisma.mailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Conta não encontrada.");
  if (!account.active) return { imported: 0, skipped: true };

  const client = imapClientFor(account);
  client.on("error", () => {});
  let imported = 0;
  try {
    await client.connect();
    const folders: { path: string; folder: "INBOX" | "SENT" }[] = [{ path: "INBOX", folder: "INBOX" }];
    const list = await client.list();
    const sent = list.find((m) => m.specialUse === "\\Sent");
    if (sent) folders.push({ path: sent.path, folder: "SENT" });

    for (const { path, folder } of folders) {
      const last = await prisma.mailMessage.findFirst({
        where: { accountId: account.id, folder, uid: { not: null } },
        orderBy: { uid: "desc" },
        select: { uid: true },
      });
      const lock = await client.getMailboxLock(path);
      try {
        let uids: number[];
        if (last?.uid) {
          const found = await client.search({ uid: `${last.uid + 1}:*` }, { uid: true });
          // "N:*" sempre devolve ao menos a última mensagem, mesmo já gravada.
          uids = (found || []).filter((u) => u > last.uid!);
        } else {
          const since = new Date(Date.now() - FIRST_SYNC_DAYS * 86_400_000);
          const found = await client.search({ since }, { uid: true });
          uids = (found || []).slice(-FIRST_SYNC_LIMIT);
        }
        if (uids.length === 0) continue;

        for await (const msg of client.fetch(uids, { uid: true, source: true, flags: true }, { uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const from = addrText(parsed.from);
          const to = addrText(parsed.to);
          const cc = addrText(parsed.cc);
          const subject = parsed.subject?.trim() || "(sem assunto)";
          const body = (parsed.text?.trim() || (typeof parsed.html === "string" ? htmlToText(parsed.html) : "")).slice(0, MAX_BODY_CHARS);
          const contactId = await findContactForAddresses(
            extractAddresses([from, to, cc].join(", ")),
            account.emailAddress,
          );
          const order = await findOrderForSubject(contactId, subject);
          const data = {
            messageId: parsed.messageId ?? null,
            inReplyTo: typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : null,
            fromAddr: from || "(desconhecido)",
            toAddrs: to,
            ccAddrs: cc || null,
            subject,
            bodyText: body,
            date: parsed.date ?? new Date(),
            seen: msg.flags?.has("\\Seen") ?? false,
            attachments: parsed.attachments.length
              ? parsed.attachments.map((a) => ({ filename: a.filename ?? "anexo", size: a.size, contentType: a.contentType }))
              : undefined,
            contactId: contactId ?? order?.contactId ?? null,
            orderId: order?.id ?? null,
          };
          await prisma.mailMessage.upsert({
            where: { accountId_folder_uid: { accountId: account.id, folder, uid: msg.uid } },
            update: { seen: data.seen },
            create: { ...data, accountId: account.id, folder, uid: msg.uid },
          });
          imported++;
        }
      } finally {
        lock.release();
      }
    }
    await prisma.mailAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date(), lastSyncError: null } });
    return { imported, skipped: false };
  } catch (e) {
    const error = friendlyMailError(e);
    await prisma.mailAccount.update({ where: { id: account.id }, data: { lastSyncError: error } });
    throw new Error(error);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export async function syncAccountForSession(session: Session, accountId: string) {
  const account = await requireAccountAccess(session, accountId);
  return syncAccount(account.id);
}

/** Cron: todas as contas ativas em sequência; a falha de uma não para as outras. */
export async function syncAllAccounts() {
  const accounts = await prisma.mailAccount.findMany({ where: { active: true }, select: { id: true, emailAddress: true } });
  const results: { account: string; imported?: number; error?: string }[] = [];
  for (const a of accounts) {
    try {
      const r = await syncAccount(a.id);
      results.push({ account: a.emailAddress, imported: r.imported });
    } catch (e) {
      results.push({ account: a.emailAddress, error: e instanceof Error ? e.message : "falha" });
    }
  }
  return results;
}
