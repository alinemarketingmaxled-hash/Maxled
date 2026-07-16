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

/** A plain server-side fetch with no User-Agent looks like a bot to some
 * providers' WAFs and gets a blanket 403 — sending one that matches a real
 * browser avoids that without changing anything else about the request. */
const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

async function fetchCnpj(digits: string): Promise<Response> {
  return fetch(`${BRASILAPI_URL}/${digits}`, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
}

/** Looks up a CNPJ against BrasilAPI and returns whatever fields it can
 * fill in on a Contact, or a reason it couldn't. Never throws. Retries
 * once — on a thrown network error or on any non-404 failure response —
 * since free public APIs like this one see transient blips a second
 * attempt often clears up. */
export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupOutcome> {
  const digits = rawCnpj.replace(/\D/g, "");
  if (digits.length !== 14) return { ok: false, reason: "invalid" };

  let response: Response | null = null;
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    try {
      const res = await fetchCnpj(digits);
      if (res.ok || res.status === 404) response = res;
    } catch {
      // fall through to retry
    }
  }
  if (!response) return { ok: false, reason: "error" };

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
