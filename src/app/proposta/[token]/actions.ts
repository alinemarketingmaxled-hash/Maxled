"use server";

import { acceptProposal } from "@/lib/erp/proposal";
import { OrderError } from "@/lib/erp/orders";

export type AcceptState = { ok: boolean; message: string } | null;

/** Aprovação pública da proposta (sem login): o token do link é a única
 * credencial e só permite aprovar a própria cotação. */
export async function acceptProposalAction(token: string, _prev: AcceptState, fd: FormData): Promise<AcceptState> {
  const name = String(fd.get("name") ?? "");
  if (fd.get("agree") !== "on") return { ok: false, message: "Confirme que leu e concorda com a proposta." };
  try {
    const res = await acceptProposal(token, name);
    if (!res) return { ok: false, message: "Não foi possível aprovar agora. Tente de novo." };
    if (res.already) return { ok: true, message: "Esta proposta já tinha sido aprovada. Obrigado!" };
    return {
      ok: true,
      message:
        res.status === "APROVADO"
          ? "Proposta aprovada! Seu pedido já está confirmado e vai para separação."
          : "Proposta aprovada! Nossa equipe vai confirmar o pedido e você recebe o retorno em breve.",
    };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message };
    console.error("[proposta] falha ao aprovar", e);
    return { ok: false, message: "Não foi possível aprovar agora. Tente de novo em instantes." };
  }
}
