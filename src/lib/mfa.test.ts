import { describe, expect, it } from "vitest";
import { Secret, TOTP } from "otpauth";
import { buildMfaSetup, generateMfaSecret, verifyMfaToken } from "./mfa";

function currentCodeFor(secretBase32: string) {
  const totp = new TOTP({
    issuer: "Maxled CRM",
    label: "test",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

describe("generateMfaSecret", () => {
  it("returns a base32 string", () => {
    const secret = generateMfaSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("returns a different secret every call", () => {
    const a = generateMfaSecret();
    const b = generateMfaSecret();
    expect(a).not.toBe(b);
  });
});

describe("verifyMfaToken", () => {
  it("accepts the current valid code for the secret", () => {
    const secret = generateMfaSecret();
    const code = currentCodeFor(secret);
    expect(verifyMfaToken(secret, code)).toBe(true);
  });

  it("rejects a code from a different secret", () => {
    const secretA = generateMfaSecret();
    const secretB = generateMfaSecret();
    const codeForB = currentCodeFor(secretB);
    expect(verifyMfaToken(secretA, codeForB)).toBe(false);
  });

  it("rejects a malformed token (not 6 digits)", () => {
    const secret = generateMfaSecret();
    expect(verifyMfaToken(secret, "12345")).toBe(false);
    expect(verifyMfaToken(secret, "abcdef")).toBe(false);
    expect(verifyMfaToken(secret, "")).toBe(false);
  });

  it("tolerates surrounding whitespace", () => {
    const secret = generateMfaSecret();
    const code = currentCodeFor(secret);
    expect(verifyMfaToken(secret, ` ${code} `)).toBe(true);
  });
});

describe("buildMfaSetup", () => {
  it("returns an otpauth QR code as a data URL, generated offline", async () => {
    const secret = generateMfaSecret();
    const { qrDataUrl } = await buildMfaSetup(secret, "user@example.com");
    expect(qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
