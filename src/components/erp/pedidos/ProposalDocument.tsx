import { Logo } from "@/components/shell/Logo";
import { fmtDate, fmtMoney, fmtNumber, orderCode } from "@/lib/erp/format";
import type { PublicProposal } from "@/lib/erp/proposal";

/** Documento da proposta comercial (tela e impressão/PDF). Recebe só dados
 * públicos: nenhum custo, margem ou observação interna. */
export function ProposalDocument({
  order,
  expiresAt,
  link,
  qrDataUrl,
}: {
  order: PublicProposal;
  expiresAt: Date | null;
  link?: string | null;
  qrDataUrl?: string | null;
}) {
  const c = order.company;
  const ct = order.contact;
  const customer = ct.accountName || `${ct.firstName} ${ct.lastName}`.trim();
  const gross = order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const lineDiscounts = gross - Number(order.itemsTotal);
  const discounts = lineDiscounts + Number(order.discountTotal);
  const inst = order.installments || 1;
  const dueDays = Array.from({ length: inst }, (_, k) => order.firstDueDays + k * order.intervalDays).join("/");
  const address = [c.street && `${c.street}${c.number ? `, ${c.number}` : ""}`, c.district, c.city && `${c.city}/${c.state ?? ""}`].filter(Boolean).join(" · ");

  return (
    <article className="proposal-paper" aria-label={`Proposta ${orderCode(c.code, order.number)}`}>
      <header className="pp-head">
        <div className="pp-brand">
          <Logo size={48} />
          <div>
            <p className="pp-name">{c.tradeName || "MAX LED"}</p>
            <p className="pp-small">{c.name}</p>
            <p className="pp-small">
              {c.cnpj ? `CNPJ ${c.cnpj}` : ""}
              {address ? ` · ${address}` : ""}
            </p>
            <p className="pp-small">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="pp-doc">
          <p className="pp-kicker">Proposta comercial</p>
          <p className="pp-code">{orderCode(c.code, order.number)}</p>
          <p className="pp-small">Emitida em {fmtDate(order.proposalSentAt ?? order.createdAt)}</p>
          {expiresAt && <p className="pp-small">Válida até {fmtDate(expiresAt)}</p>}
        </div>
      </header>

      <section className="pp-parties">
        <div>
          <p className="pp-label">Cliente</p>
          <p className="pp-strong">{customer}</p>
          {ct.cnpj && <p>CNPJ {ct.cnpj}</p>}
          <p>{[ct.city && `${ct.city}/${ct.state ?? ""}`, ct.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div>
          <p className="pp-label">Seu vendedor</p>
          <p className="pp-strong">{order.seller.name}</p>
          {order.seller.email && <p>{order.seller.email}</p>}
        </div>
      </section>

      <table className="pp-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Produto</th>
            <th className="r">Qtd</th>
            <th className="r">Valor unit.</th>
            <th className="r">Desc.</th>
            <th className="r">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i, n) => (
            <tr key={i.id}>
              <td>{n + 1}</td>
              <td>
                <span className="pp-strong">{i.product.name}</span>
                <span className="pp-small block">
                  {i.product.sku}
                  {i.product.ncm ? ` · NCM ${i.product.ncm}` : ""}
                </span>
              </td>
              <td className="r">
                {fmtNumber(i.quantity)} {i.product.unit}
              </td>
              <td className="r">{fmtMoney(i.unitPrice)}</td>
              <td className="r">{Number(i.discountPct) > 0 ? `${Number(i.discountPct).toLocaleString("pt-BR")}%` : "-"}</td>
              <td className="r pp-strong">{fmtMoney(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="pp-bottom">
        <div className="pp-cond">
          <p className="pp-label">Condições</p>
          <p>
            <b>Pagamento:</b> {order.paymentMethod || "Boleto"} em {inst}x de {fmtMoney(Number(order.total) / inst)} ({dueDays} dias)
          </p>
          <p>
            <b>Entrega:</b> {order.shippingMode || "a combinar"}
            {order.carrier ? ` · ${order.carrier}` : ""}
            {order.freightPayer ? ` · frete por conta do ${order.freightPayer.toLowerCase()}` : ""}
          </p>
          {order.shippingAddress && (
            <p>
              <b>Endereço de entrega:</b> {order.shippingAddress}
            </p>
          )}
          <p>
            <b>Impostos:</b> conforme a legislação da operação, destacados na nota fiscal.
          </p>
          {order.notes && (
            <p className="pp-notes">
              <b>Observações:</b> {order.notes}
            </p>
          )}
        </div>
        <dl className="pp-totals">
          <dt>Subtotal</dt>
          <dd>{fmtMoney(gross)}</dd>
          <dt>Descontos</dt>
          <dd>{discounts > 0.004 ? `− ${fmtMoney(discounts)}` : fmtMoney(0)}</dd>
          <dt>Frete</dt>
          <dd>{fmtMoney(order.freight)}</dd>
          {Number(order.otherExpenses) > 0 && (
            <>
              <dt>Outras despesas</dt>
              <dd>{fmtMoney(order.otherExpenses)}</dd>
            </>
          )}
          <dt className="pp-total">Total</dt>
          <dd className="pp-total">{fmtMoney(order.total)}</dd>
        </dl>
      </section>

      {link && (
        <footer className="pp-foot">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor como data URL
            <img src={qrDataUrl} alt="QR code do link de aprovação" width={92} height={92} />
          )}
          <div>
            <p className="pp-strong">Aprove online</p>
            <p className="pp-small break-all">{link}</p>
            <p className="pp-small">Ao aprovar, o pedido segue para separação e você acompanha pelo portal do cliente.</p>
          </div>
        </footer>
      )}
    </article>
  );
}
