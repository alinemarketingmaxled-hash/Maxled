import "server-only";

const NETSAPP_URL =
  process.env.NETSAPP_API_URL || "https://app2.netsapp.com.br:443/backend/api/messages/send";

export function isWhatsAppConfigured(token: string | null | undefined): token is string {
  return !!token && token.trim().length > 0;
}

/** Netsapp expects digits only, with the 55 country code — same shape as
 * the wa.me deep links already used elsewhere in the app. */
function formatNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendWhatsAppMessage(token: string, toNumber: string, body: string): Promise<void> {
  const number = formatNumber(toNumber);

  let response: Response;
  try {
    response = await fetch(NETSAPP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number,
        body,
        saveOnTicket: true,
        linkPreview: true,
        startChatbot: true,
      }),
    });
  } catch {
    throw new Error("Não foi possível conectar ao WhatsApp (Netsapp). Verifique sua conexão.");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar WhatsApp (${response.status}): ${text || "erro desconhecido"}`);
  }
}
