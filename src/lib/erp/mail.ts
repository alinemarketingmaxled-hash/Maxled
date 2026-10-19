import "server-only";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import type { Session } from "next-auth";
import type { Prisma, Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit, canView, getPermission } from "@/lib/permissions";
import { orderContactScope, orderScopeWhere } from "@/lib/erp/orders";
import { logActivity } from "@/lib/activity-log";
import { decryptSecret, encryptSecret } from "@/lib/erp/crypto";
import { extractAddresses, friendlyMailError, parseOrderRefs } from "@/lib/erp/mail-utils";

export class MailError extends Error {}

const CONNECT_TIMEOUT_MS = 15_000;
// Vercel rejeita corpos acima de ~4,5 MB; o limite fica abaixo disso.
export const MAX_ATTACHMENTS_BYTES = 4 * 1024 * 1024;

/** Campos de conta seguros para a interface — passwordEnc nunca sai daqui. */
export const SAFE_ACCOUNT_SELECT = {
  id: true,
  ownerId: true,
  emailAddress: true,
  displayName: true,
  imapHost: true,
  imapPort: true,
  imapSecure: true,
  smtpHost: true,
  smtpPort: true,
  smtpSecure: true,
  username: true,
  active: true,
  lastSyncAt: true,
  lastSyncError: true,
  owner: { select: { id: true, name: true } },
  shares: { select: { userId: true, user: { select: { name: true } } } },
} satisfies Prisma.MailAccountSelect;

/** Admin e Mediador configuram caixas de qualquer usuário, mas não leem
 * mensagens de caixas que não são suas nem foram compartilhadas com eles. */
export function isMailAdmin(role: Role) {
  return role === "ADMIN" || role === "MEDIATOR";
}

function accessWhere(session: Session): Prisma.MailAccountWhereInput {
  return { OR: [{ ownerId: session.user.id }, { shares: { some: { userId: session.user.id } } }] };
}

/** Caixas que o usuário pode ler/usar: as próprias e as compartilhadas
 * explicitamente com ele (decisão padrão §12). */
export async function accessibleAccountIds(session: Session): Promise<string[]> {
  if (session.user.role === "CUSTOMER") return [];
  const rows = await prisma.mailAccount.findMany({ where: accessWhere(session), select: { id: true } });
  return rows.map((r) => r.id);
}

export async function listAccessibleAccounts(session: Session) {
  if (session.user.role === "CUSTOMER") return [];
  return prisma.mailAccount.findMany({
    where: accessWhere(session),
    orderBy: { emailAddress: "asc" },
    select: SAFE_ACCOUNT_SELECT,
  });
}

export async function requireAccountAccess(session: Session, accountId: string) {
  if (session.user.role === "CUSTOMER") throw new MailError("Sem acesso a esta caixa.");
  const account = await prisma.mailAccount.findFirst({
    where: { id: accountId, ...accessWhere(session) },
    select: SAFE_ACCOUNT_SELECT,
  });
  if (!account) throw new MailError("Sem acesso a esta caixa de e-mail.");
  return account;
}

/** Configuração da conta (não as mensagens): dono ou admin. */
async function requireAccountConfig(session: Session, accountId: string) {
  const account = await prisma.mailAccount.findUnique({ where: { id: accountId }, select: { id: true, ownerId: true } });
  if (!account) throw new MailError("Conta não encontrada.");
  if (account.ownerId !== session.user.id && !isMailAdmin(session.user.role)) {
    throw new MailError("Apenas o dono da caixa ou o administrador altera esta configuração.");
  }
  return account;
}

export async function listAllAccountsForAdmin(session: Session) {
  if (!isMailAdmin(session.user.role)) return [];
  return prisma.mailAccount.findMany({ orderBy: { emailAddress: "asc" }, select: SAFE_ACCOUNT_SELECT });
}

export async function getMessageForSession(session: Session, id: string) {
  const ids = await accessibleAccountIds(session);
  return prisma.mailMessage.findFirst({
    where: { id, accountId: { in: ids } },
    include: {
      account: { select: { id: true, emailAddress: true, displayName: true } },
      contact: { select: { id: true, firstName: true, lastName: true, accountName: true } },
      order: { select: { id: true, number: true, company: { select: { code: true } } } },
    },
  });
}

export type AccountInput = {
  ownerId?: string | null;
  emailAddress: string;
  displayName?: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password?: string | null;
  active: boolean;
};

function validPort(n: number) {
  return Number.isInteger(n) && n > 0 && n < 65536;
}

export async function saveAccount(session: Session, input: AccountInput, id?: string) {
  if (!canEdit(session.user.role, "emails")) throw new MailError("Sem permissão.");
  const email = input.emailAddress.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MailError("E-mail inválido.");
  if (!input.imapHost.trim() || !input.smtpHost.trim()) throw new MailError("Informe os hosts IMAP e SMTP.");
  if (!validPort(input.imapPort) || !validPort(input.smtpPort)) throw new MailError("Porta inválida.");
  if (!input.username.trim()) throw new MailError("Informe o usuário de autenticação.");

  // Usuário comum só cadastra a própria caixa; admin escolhe o dono.
  let ownerId = session.user.id;
  if (isMailAdmin(session.user.role) && input.ownerId) {
    const owner = await prisma.user.findFirst({ where: { id: input.ownerId, deletedAt: null }, select: { id: true } });
    if (!owner) throw new MailError("Usuário dono inválido.");
    ownerId = owner.id;
  }

  const data = {
    emailAddress: email,
    displayName: input.displayName?.trim() || null,
    imapHost: input.imapHost.trim(),
    imapPort: input.imapPort,
    imapSecure: input.imapSecure,
    smtpHost: input.smtpHost.trim(),
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    username: input.username.trim(),
    active: input.active,
  };

  if (id) {
    const existing = await requireAccountConfig(session, id);
    const account = await prisma.mailAccount.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(isMailAdmin(session.user.role) ? { ownerId } : {}),
        // Senha em branco na edição mantém a atual.
        ...(input.password ? { passwordEnc: encryptSecret(input.password) } : {}),
      },
      select: { id: true },
    });
    await logActivity({ actorId: session.user.id, entityType: "MailAccount", entityId: account.id, action: "updated", diff: { emailAddress: email } });
    return account;
  }
  if (!input.password) throw new MailError("Informe a senha da caixa.");
  const account = await prisma.mailAccount.create({
    data: { ...data, ownerId, passwordEnc: encryptSecret(input.password) },
    select: { id: true },
  });
  await logActivity({ actorId: session.user.id, entityType: "MailAccount", entityId: account.id, action: "created", diff: { emailAddress: email, ownerId } });
  return account;
}

export async function setAccountShare(session: Session, accountId: string, userId: string, share: boolean) {
  await requireAccountConfig(session, accountId);
  const account = await prisma.mailAccount.findUniqueOrThrow({ where: { id: accountId }, select: { ownerId: true } });
  if (userId === account.ownerId) throw new MailError("O dono já tem acesso à caixa.");
  if (share) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
    if (!user) throw new MailError("Usuário inválido.");
    await prisma.mailAccountAccess.upsert({
      where: { accountId_userId: { accountId, userId } },
      update: {},
      create: { accountId, userId },
    });
  } else {
    await prisma.mailAccountAccess.deleteMany({ where: { accountId, userId } });
  }
  await logActivity({
    actorId: session.user.id,
    entityType: "MailAccount",
    entityId: accountId,
    action: "access_changed",
    diff: { userId, share },
  });
}

// ---------------------------------------------------------------------------
// Conexões. Credenciais são decifradas só aqui, no servidor.
// ---------------------------------------------------------------------------

type FullAccount = Prisma.MailAccountGetPayload<object>;

export function imapClientFor(account: FullAccount) {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: { user: account.username, pass: decryptSecret(account.passwordEnc) },
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: 60_000,
  });
}

function smtpTransportFor(account: FullAccount) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    requireTLS: !account.smtpSecure,
    auth: { user: account.username, pass: decryptSecret(account.passwordEnc) },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: 60_000,
  });
}

/** Testa IMAP (login) e SMTP (verify). Devolve mensagens amigáveis. */
export async function testAccountConnection(session: Session, accountId: string) {
  await requireAccountConfig(session, accountId);
  const account = await prisma.mailAccount.findUniqueOrThrow({ where: { id: accountId } });
  const result: { imap: string; smtp: string; ok: boolean } = { imap: "", smtp: "", ok: true };

  const client = imapClientFor(account);
  client.on("error", () => {});
  try {
    await client.connect();
    result.imap = "IMAP conectado.";
  } catch (e) {
    result.ok = false;
    result.imap = `IMAP: ${friendlyMailError(e)}`;
  } finally {
    await client.logout().catch(() => client.close());
  }

  const transport = smtpTransportFor(account);
  try {
    await transport.verify();
    result.smtp = "SMTP conectado.";
  } catch (e) {
    result.ok = false;
    result.smtp = `SMTP: ${friendlyMailError(e)}`;
  } finally {
    transport.close();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Associação automática a clientes e pedidos.
// ---------------------------------------------------------------------------

/** Primeiro cliente cujo e-mail comercial/financeiro/NF-e aparece entre os
 * endereços (ignorando os da própria caixa). */
export async function findContactForAddresses(addresses: string[], ownAddress: string) {
  const list = addresses.filter((a) => a !== ownAddress.toLowerCase());
  if (list.length === 0) return null;
  const or = list.flatMap((a) => [
    { email: { equals: a, mode: "insensitive" as const } },
    { emailFinanceiro: { equals: a, mode: "insensitive" as const } },
    { emailNfe: { equals: a, mode: "insensitive" as const } },
  ]);
  const contact = await prisma.contact.findFirst({ where: { deletedAt: null, OR: or }, select: { id: true } });
  return contact?.id ?? null;
}

export async function findOrderForSubject(contactId: string | null, subject: string) {
  const refs = parseOrderRefs(subject);
  for (const ref of refs) {
    const order = await prisma.salesOrder.findFirst({
      where: {
        number: ref.number,
        ...(ref.companyCode ? { company: { code: ref.companyCode } } : {}),
        // Sem código de empresa o número é ambíguo: só associa se for do cliente.
        ...(contactId ? { contactId } : ref.companyCode ? {} : { id: "__none__" }),
      },
      select: { id: true, contactId: true },
    });
    if (order) return order;
  }
  return null;
}

/** Quais clientes/pedidos o usuário pode vincular a uma mensagem: a mesma
 * carteira que ele enxerga em Pedidos (ou em Clientes, para quem não tem
 * Pedidos). null = sem acesso. */
export function associationScope(session: Session, companyId: string) {
  let contactWhere: Prisma.ContactWhereInput | null = null;
  if (canView(session.user.role, "pedidos")) contactWhere = orderContactScope(session);
  else if (canView(session.user.role, "vendas")) {
    const own = getPermission(session.user.role, "vendas").scope === "own";
    contactWhere = { deletedAt: null, ...(own ? { ownerId: session.user.id } : {}) };
  }
  const orderWhere: Prisma.SalesOrderWhereInput | null = canView(session.user.role, "pedidos")
    ? orderScopeWhere(session, companyId)
    : null;
  return { contactWhere, orderWhere };
}

export async function associateMessage(
  session: Session,
  companyId: string,
  messageId: string,
  input: { contactId: string | null; orderId: string | null },
) {
  const msg = await getMessageForSession(session, messageId);
  if (!msg) throw new MailError("Mensagem não encontrada.");
  const scope = associationScope(session, companyId);
  let contactId = input.contactId;
  let orderId: string | null = null;
  if (input.orderId) {
    if (!scope.orderWhere) throw new MailError("Sem acesso a pedidos.");
    const order = await prisma.salesOrder.findFirst({ where: { id: input.orderId, ...scope.orderWhere }, select: { id: true, contactId: true } });
    if (!order) throw new MailError("Pedido não encontrado na empresa ativa.");
    orderId = order.id;
    // O cliente do e-mail passa a ser sempre o do pedido.
    contactId = order.contactId;
  }
  if (contactId && !input.orderId) {
    if (!scope.contactWhere) throw new MailError("Sem acesso a clientes.");
    const contact = await prisma.contact.findFirst({ where: { id: contactId, ...scope.contactWhere }, select: { id: true } });
    if (!contact) throw new MailError("Cliente não encontrado na sua carteira.");
  }
  await prisma.mailMessage.update({ where: { id: msg.id }, data: { contactId, orderId } });
}

// ---------------------------------------------------------------------------
// Envio e rascunhos.
// ---------------------------------------------------------------------------

export type ComposeInput = {
  accountId: string;
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
  contactId?: string | null;
  orderId?: string | null;
  inReplyTo?: string | null;
  draftId?: string | null;
  requestKey: string;
  files: File[];
  /** Empresa ativa — vínculo manual a pedido só dentro dela. */
  companyId: string;
};

async function resolveLinks(session: Session, input: ComposeInput, to: string[], own: string, subject: string) {
  const scope = associationScope(session, input.companyId);
  let contactId: string | null = null;
  let orderId: string | null = null;
  // Vínculos escolhidos à mão só valem dentro da carteira do usuário.
  if (input.orderId && scope.orderWhere) {
    const order = await prisma.salesOrder.findFirst({ where: { id: input.orderId, ...scope.orderWhere }, select: { id: true, contactId: true } });
    if (order) {
      orderId = order.id;
      contactId = order.contactId;
    }
  }
  if (!contactId && input.contactId && scope.contactWhere) {
    const c = await prisma.contact.findFirst({ where: { id: input.contactId, ...scope.contactWhere }, select: { id: true } });
    contactId = c?.id ?? null;
  }
  contactId = contactId ?? (await findContactForAddresses(to, own));
  if (!orderId) orderId = (await findOrderForSubject(contactId, subject))?.id ?? null;
  return { contactId, orderId };
}

function attachmentsMeta(files: File[]) {
  return files.map((f) => ({ filename: f.name, size: f.size, contentType: f.type || "application/octet-stream" }));
}

export async function saveDraft(session: Session, input: ComposeInput) {
  const account = await requireAccountAccess(session, input.accountId);
  const to = extractAddresses(input.to);
  const links = await resolveLinks(session, input, to, account.emailAddress, input.subject);
  const data = {
    accountId: account.id,
    folder: "DRAFTS",
    fromAddr: account.displayName ? `${account.displayName} <${account.emailAddress}>` : account.emailAddress,
    toAddrs: input.to.trim(),
    ccAddrs: input.cc?.trim() || null,
    subject: input.subject.trim() || "(sem assunto)",
    bodyText: input.body,
    date: new Date(),
    seen: true,
    inReplyTo: input.inReplyTo || null,
    attachments: input.files.length ? attachmentsMeta(input.files) : undefined,
    ...links,
  };
  if (input.draftId) {
    const draft = await prisma.mailMessage.findFirst({ where: { id: input.draftId, folder: "DRAFTS", accountId: account.id } });
    if (draft) return prisma.mailMessage.update({ where: { id: draft.id }, data });
  }
  return prisma.mailMessage.create({ data });
}

/** Envia via SMTP da conta. O Message-ID deriva da requestKey do
 * formulário: um reenvio (duplo clique, rede instável) encontra a mensagem
 * já gravada em Enviados e não manda de novo. */
export async function sendMail(session: Session, input: ComposeInput) {
  const safe = await requireAccountAccess(session, input.accountId);
  if (!safe.active) throw new MailError("Caixa desativada.");
  const to = extractAddresses(input.to);
  const cc = extractAddresses(input.cc);
  if (to.length === 0) throw new MailError("Informe ao menos um destinatário válido.");
  if (!input.subject.trim()) throw new MailError("Informe o assunto.");
  const totalSize = input.files.reduce((s, f) => s + f.size, 0);
  if (totalSize > MAX_ATTACHMENTS_BYTES) throw new MailError("Anexos acima do limite de 4 MB.");
  if (!/^[A-Za-z0-9-]{8,80}$/.test(input.requestKey)) throw new MailError("Requisição inválida.");

  const messageId = `<${input.requestKey}@maxled-erp>`;
  const already = await prisma.mailMessage.findFirst({ where: { accountId: safe.id, folder: "SENT", messageId } });
  if (already) return { message: already, duplicate: true };

  const account = await prisma.mailAccount.findUniqueOrThrow({ where: { id: safe.id } });
  const from = account.displayName ? `${account.displayName} <${account.emailAddress}>` : account.emailAddress;
  const links = await resolveLinks(session, input, [...to, ...cc], account.emailAddress, input.subject);
  const attachments = await Promise.all(
    input.files.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()), contentType: f.type || undefined })),
  );

  const transport = smtpTransportFor(account);
  try {
    await transport.sendMail({
      from,
      to: input.to,
      cc: input.cc || undefined,
      subject: input.subject.trim(),
      text: input.body,
      messageId,
      inReplyTo: input.inReplyTo || undefined,
      references: input.inReplyTo || undefined,
      attachments,
    });
  } catch (e) {
    const error = friendlyMailError(e);
    // Falha de envio: guarda como rascunho com o erro, para reenviar depois.
    await saveDraft(session, input).then((d) =>
      prisma.mailMessage.update({ where: { id: d.id }, data: { sendError: error } }),
    );
    throw new MailError(`${error} A mensagem foi salva em Rascunhos.`);
  } finally {
    transport.close();
  }

  const message = await prisma.mailMessage.create({
    data: {
      accountId: account.id,
      folder: "SENT",
      messageId,
      inReplyTo: input.inReplyTo || null,
      fromAddr: from,
      toAddrs: input.to.trim(),
      ccAddrs: input.cc?.trim() || null,
      subject: input.subject.trim(),
      bodyText: input.body,
      date: new Date(),
      seen: true,
      attachments: input.files.length ? attachmentsMeta(input.files) : undefined,
      ...links,
    },
  });
  if (input.draftId) {
    await prisma.mailMessage.deleteMany({ where: { id: input.draftId, folder: "DRAFTS", accountId: account.id } });
  }
  return { message, duplicate: false };
}

export async function deleteDraft(session: Session, messageId: string) {
  const msg = await getMessageForSession(session, messageId);
  if (!msg || msg.folder !== "DRAFTS") throw new MailError("Rascunho não encontrado.");
  await prisma.mailMessage.delete({ where: { id: msg.id } });
}
