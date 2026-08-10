import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupCep } from "./cep-lookup";

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

describe("lookupCep", () => {
  it("rejects a CEP that isn't 8 digits without calling the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const outcome = await lookupCep("123");
    expect(outcome).toEqual({ ok: false, reason: "invalid" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a formatted address on success", async () => {
    mockFetchOnce(200, {
      cep: "01310-100",
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
    });
    const outcome = await lookupCep("01310100");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.street).toBe("Avenida Paulista");
      expect(outcome.result.city).toBe("São Paulo");
      expect(outcome.result.state).toBe("SP");
      expect(outcome.result.postalCode).toBe("01310-100");
      expect(outcome.result.formattedAddress).toContain("Avenida Paulista");
      expect(outcome.result.formattedAddress).toContain("São Paulo - SP");
    }
  });

  it("maps ViaCEP's { erro: true } to not_found", async () => {
    mockFetchOnce(200, { erro: true });
    const outcome = await lookupCep("00000000");
    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("maps a thrown network error to 'error' after retrying", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const outcome = await lookupCep("01310100");
    expect(outcome).toEqual({ ok: false, reason: "error" });
  });
});
