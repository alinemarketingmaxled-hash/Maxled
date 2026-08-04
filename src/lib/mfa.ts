import "server-only";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Maxled CRM";

function buildTotp(secretBase32: string, accountLabel: string) {
  return new TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function generateMfaSecret(): string {
  return new Secret({ size: 20 }).base32;
}

/** QR code + manual-entry key for the "scan with your authenticator app"
 * step — generated fully offline (no external service call). */
export async function buildMfaSetup(secretBase32: string, accountLabel: string) {
  const otpauthUrl = buildTotp(secretBase32, accountLabel).toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { otpauthUrl, qrDataUrl };
}

/** window: 1 tolerates the code from the previous/next 30s step, covering
 * small clock drift between the phone and the server. */
export function verifyMfaToken(secretBase32: string, token: string, accountLabel = ""): boolean {
  const cleaned = token.trim();
  if (!/^\d{6}$/.test(cleaned)) return false;
  return buildTotp(secretBase32, accountLabel).validate({ token: cleaned, window: 1 }) !== null;
}
