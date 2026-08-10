import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupCnpj } from "./cnpj-lookup";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookupCnpj", () => {
  it("rejects a CNPJ that isn't 14 digits without calling the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const outcome = await lookupCnpj("123");
    expect(outcome).toEqual({ ok: false, reason: "invalid" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns mapped fields on success", async () => {
    mockFetchOnce(200, {
      razao_social: "Maxled Distribuidora Ltda",
      ddd_telefone_1: "11988887777",
      logradouro: "Av. Paulista",
      numero: "1000",
      municipio: "São Paulo",
      uf: "SP",
      cep: 1310100,
    });
    const outcome = await lookupCnpj("12345678000199");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.accountName).toBe("Maxled Distribuidora Ltda");
      expect(outcome.result.phone).toBe("11988887777");
      expect(outcome.result.city).toBe("São Paulo");
      expect(outcome.result.postalCode).toBe("01310-100");
    }
  });

  it("falls back to nome_fantasia when razao_social is absent", async () => {
    mockFetchOnce(200, { nome_fantasia: "Loja Maxled" });
    const outcome = await lookupCnpj("12345678000199");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.accountName).toBe("Loja Maxled");
  });

  it("maps a 404 to not_found", async () => {
    mockFetchOnce(404, {});
    const outcome = await lookupCnpj("12345678000199");
    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("maps a thrown network error to 'error' after retrying", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const outcome = await lookupCnpj("12345678000199");
    expect(outcome).toEqual({ ok: false, reason: "error" });
  });
});
