import "server-only";
import { Prisma } from "@/generated/prisma/client";

export type ActionResult = { ok: true; message?: string; redirectTo?: string } | { ok: false; error: string };

/** Envolve o corpo de uma server action: erros de regra de negócio viram
 * mensagem para o usuário (em produção o Next esconde o texto de exceções
 * lançadas), violações de unicidade viram aviso de duplicidade. Erros de
 * redirect/notFound do Next são relançados intactos. */
export async function runAction(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_")) {
      throw e;
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Registro duplicado: já existe um cadastro com esses dados." };
    }
    if (e instanceof Error) {
      console.error("[erp action]", e);
      return { ok: false, error: e.message || "Falha inesperada." };
    }
    return { ok: false, error: "Falha inesperada." };
  }
}

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  // Aceita "1.234,56" (pt-BR) e "1234.56".
  const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  return Number.isFinite(n) ? n : null;
}

export function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n === null ? null : Math.trunc(n);
}

export function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!v) return null;
  // Datas de <input type="date"> são dias civis: meio-dia UTC evita virar
  // o dia anterior no fuso de São Paulo.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00.000Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
