import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Segredos de integração (senhas IMAP/SMTP, tokens do Mercado Livre,
 * credenciais do provedor fiscal) ficam cifrados em repouso com AES-256-GCM.
 * A chave vem de ERP_ENCRYPTION_KEY (ou, na falta dela, de AUTH_SECRET) e
 * nunca sai do servidor. Trocar a chave exige recadastrar os segredos. */
function key(): Buffer {
  const secret = process.env.ERP_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("ERP_ENCRYPTION_KEY/AUTH_SECRET não configurado.");
  return createHash("sha256").update(`maxled-erp:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Segredo em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
