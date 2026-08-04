import "server-only";

const VIACEP_URL = "https://viacep.com.br/ws";

/** ViaCEP — free, no key required, public Brazilian postal-code lookup. */
type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export type CepLookupResult = {
  /** Ready to drop into a free-text address field (street, neighborhood,
   * city - state, CEP) — ViaCEP has no house number, so that part is left
   * for the person to fill in by hand. */
  formattedAddress: string;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string;
};

export type CepLookupOutcome =
  | { ok: true; result: CepLookupResult }
  | { ok: false; reason: "invalid" | "not_found" | "error" };

async function fetchCep(digits: string): Promise<Response> {
  return fetch(`${VIACEP_URL}/${digits}/json/`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
}

/** Looks up a CEP against ViaCEP. Never throws — retries once on a thrown
 * network error, same pattern as lib/cnpj-lookup.ts. */
export async function lookupCep(rawCep: string): Promise<CepLookupOutcome> {
  const digits = rawCep.replace(/\D/g, "");
  if (digits.length !== 8) return { ok: false, reason: "invalid" };

  let response: Response | null = null;
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    try {
      const res = await fetchCep(digits);
      if (res.ok) response = res;
    } catch {
      // fall through to retry
    }
  }
  if (!response) return { ok: false, reason: "error" };

  const data = (await response.json().catch(() => null)) as ViaCepResponse | null;
  if (!data || data.erro) return { ok: false, reason: "not_found" };

  const postalCode = `${digits.slice(0, 5)}-${digits.slice(5)}`;
  const cityState = data.localidade && data.uf ? `${data.localidade} - ${data.uf}` : data.localidade || data.uf || null;
  const formattedAddress = [data.logradouro, data.bairro, cityState, postalCode].filter(Boolean).join(", ");

  return {
    ok: true,
    result: {
      formattedAddress,
      street: data.logradouro || null,
      city: data.localidade || null,
      state: data.uf || null,
      postalCode,
    },
  };
}
