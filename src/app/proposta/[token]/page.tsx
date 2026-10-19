import type { Metadata } from "next";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { isLinkPreviewBot, viewProposal } from "@/lib/erp/proposal";
import { appOrigin } from "@/lib/erp/public-url";
import { fmtDateTime, orderCode } from "@/lib/erp/format";
import { ProposalDocument } from "@/components/erp/pedidos/ProposalDocument";
import { PrintButton } from "@/components/erp/pedidos/ProposalButtons";
import { acceptProposalAction } from "./actions";
import { AcceptForm } from "./AcceptForm";

export const metadata: Metadata = {
  title: "Proposta comercial | MAX LED",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Página pública da proposta, aberta pelo link enviado ao cliente. */
export default async function PropostaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await viewProposal(token, !isLinkPreviewBot((await headers()).get("user-agent")));

  if (!res) {
    return (
      <main className="proposal-public">
        <div className="proposal-msg">
          <h1>Proposta não encontrada</h1>
          <p>O link pode ter sido digitado errado ou substituído por um mais novo. Peça o link atualizado ao seu vendedor MAX LED.</p>
        </div>
      </main>
    );
  }

  const { order, expired, expiresAt } = res;
  const link = `${await appOrigin()}/proposta/${token}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 184 });
  const code = orderCode(order.company.code, order.number);

  let panel: React.ReactNode;
  if (order.proposalAcceptedAt) {
    panel = <p className="accept-ok">Proposta aprovada por {order.proposalAcceptedBy} em {fmtDateTime(order.proposalAcceptedAt)}. Obrigado!</p>;
  } else if (order.status === "CANCELADO") {
    panel = <p className="accept-err">Esta proposta foi cancelada. Fale com seu vendedor para uma nova cotação.</p>;
  } else if (order.status !== "COTACAO") {
    panel = <p className="accept-ok">Este pedido já foi confirmado e está em andamento.</p>;
  } else if (expired) {
    panel = <p className="accept-err">A validade desta proposta terminou. Peça uma proposta atualizada ao seu vendedor.</p>;
  } else {
    panel = <AcceptForm action={acceptProposalAction.bind(null, token)} />;
  }

  return (
    <main className="proposal-public">
      <div className="proposal-bar print:hidden">
        <p>
          Proposta <b>{code}</b> · MAX LED
        </p>
        <PrintButton className="proposal-btn-ghost" />
      </div>
      <ProposalDocument order={order} expiresAt={expiresAt} link={order.proposalAcceptedAt || order.status !== "COTACAO" ? null : link} qrDataUrl={qr} />
      <section className="proposal-accept print:hidden" aria-label="Aprovação">
        <h2>Aprovar proposta</h2>
        {panel}
      </section>
    </main>
  );
}
