import "server-only";
import { headers } from "next/headers";

/** Endereço público do sistema para montar links enviados a clientes.
 * Usa AUTH_URL/NEXTAUTH_URL quando configurado; senão, o host da
 * requisição atual. */
export async function appOrigin() {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
