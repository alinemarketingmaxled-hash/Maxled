/** Funções puras do módulo de e-mails (sem acesso a banco), testáveis
 * fora do Next. */

export const MAIL_FOLDERS = ["INBOX", "SENT", "DRAFTS"] as const;
export type MailFolder = (typeof MAIL_FOLDERS)[number];

export const FOLDER_LABELS: Record<MailFolder, string> = {
  INBOX: "Entrada",
  SENT: "Enviados",
  DRAFTS: "Rascunhos",
};

/** Extrai endereços de uma lista "Nome <a@b>, c@d" em minúsculas. */
export function extractAddresses(list: string | null | undefined): string[] {
  if (!list) return [];
  const found = list.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
  return [...new Set(found.map((a) => a.toLowerCase()))];
}

/** Converte HTML em texto simples. O HTML recebido nunca é renderizado na
 * interface: só o texto resultante. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Referências a pedidos no assunto: "A-00012" (código com empresa) ou
 * "Pedido 12" / "Pedido nº 12" / "pedido #12". */
export function parseOrderRefs(subject: string): { companyCode: string | null; number: number }[] {
  const refs: { companyCode: string | null; number: number }[] = [];
  for (const m of subject.matchAll(/\b([A-Z])-(\d{3,})\b/g)) refs.push({ companyCode: m[1], number: Number(m[2]) });
  for (const m of subject.matchAll(/pedido\s*(?:n[º°o.]?\s*|#\s*)?(\d+)/gi)) refs.push({ companyCode: null, number: Number(m[1]) });
  return refs;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function replySubject(subject: string, kind: "reply" | "forward") {
  const prefix = kind === "reply" ? "Re:" : "Enc:";
  return new RegExp(`^${prefix}`, "i").test(subject.trim()) ? subject : `${prefix} ${subject}`;
}

export function quoteBody(body: string, from: string, date: Date) {
  const when = date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `\n\nEm ${when}, ${from} escreveu:\n${body.split("\n").map((l) => `> ${l}`).join("\n")}`;
}

/** Mensagem amigável para erros de conexão IMAP/SMTP. */
export function friendlyMailError(e: unknown): string {
  const err = e as { code?: string; message?: string; responseText?: string; authenticationFailed?: boolean };
  // Nodemailer embrulha o erro de rede (code ESOCKET/ECONNECTION) e deixa
  // o código original só na mensagem.
  const msg = err?.message ?? "";
  const code = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/.exec(msg)?.[0] ?? err?.code ?? "";
  if (err?.authenticationFailed || code === "EAUTH" || /auth/i.test(err?.responseText ?? "")) {
    return "Usuário ou senha recusados pelo servidor de e-mail.";
  }
  if (code === "ECONNREFUSED") return "Conexão recusada: confira host e porta.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "Servidor não encontrado: confira o host.";
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || /timed? ?out/i.test(err?.message ?? "")) {
    return "Tempo esgotado ao conectar: confira host, porta e TLS.";
  }
  if (/certificate|self.signed|TLS|SSL|wrong version/i.test(err?.message ?? "")) {
    return "Falha de TLS: confira se a porta usa TLS direto (993/465) ou STARTTLS (143/587).";
  }
  return err?.message ? `Falha no servidor de e-mail: ${err.message}` : "Falha desconhecida no servidor de e-mail.";
}
