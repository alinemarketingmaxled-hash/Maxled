import "server-only";

const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1";

/** Shape confirmed against BrasilAPI's own CNPJ type definitions —
 * https://brasilapi.com.br (free, no key required; proxies Receita Federal
 * public data via minhareceita.org). Only the fields we actually use. */
type BrasilApiCnpjResponse = {
  razao_social?: string;
  nome_fantasia?: string;
  ddd_telefone_1?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: number | string;
  uf?: string;
  municipio?: string;
};

export type CnpjLookupResult = {
  accountName: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

/** Distinguishes *why* a lookup didn't return data — "the CNPJ doesn't
 * exist" and "BrasilAPI is unreachable right now" need different messages,
 * and lumping them into one generic "not found" made a real outage look
 * identical to a typo. */
export type CnpjLookupOutcome =
  | { ok: true; result: CnpjLookupResult }
  | { ok: false; reason: "invalid" | "not_found" | "error" };

function formatCep(cep: number | string | undefined): string | null {
  if (cep === undefined || cep === null) return null;
  const digits = String(cep).replace(/\D/g, "").padStart(8, "0");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : String(cep);
}

/** Looks up a CNPJ against BrasilAPI and returns whatever fields it can
 * fill in on a Contact, or a reason it couldn't. Never throws. */
export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupOutcome> {
  const digits = rawCnpj.replace(/\D/g, "");
  if (digits.length !== 14) return { ok: false, reason: "invalid" };

  let response: Response;
  try {
    response = await fetch(`${BRASILAPI_URL}/${digits}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, reason: "error" };
  }

  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (!response.ok) return { ok: false, reason: "error" };

  const data = (await response.json().catch(() => null)) as BrasilApiCnpjResponse | null;
  if (!data) return { ok: false, reason: "error" };

  return {
    ok: true,
    result: {
      accountName: data.razao_social || data.nome_fantasia || null,
      phone: data.ddd_telefone_1 || null,
      street: data.logradouro || null,
      number: data.numero || null,
      city: data.municipio || null,
      state: data.uf || null,
      postalCode: formatCep(data.cep),
    },
  };
}
