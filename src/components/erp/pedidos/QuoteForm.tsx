"use client";

import { useMemo, useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Card, Field, inputCls, btnPrimary, btnSecondary, thCls, tdCls } from "@/components/erp/ui";
import { fmtMoney } from "@/lib/erp/format";
import { PAYMENT_METHODS } from "@/components/erp/pedidos/labels";

export type QuoteFormContact = {
  id: string;
  label: string;
  person: string;
  cnpj: string | null;
  ownerId: string;
  billingAddress: string | null;
  shippingAddress: string | null;
};
export type QuoteFormProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  isKit: boolean;
  price: number;
  minPrice: number | null;
  available: number;
};
export type QuoteFormSeller = { id: string; name: string };

export type QuoteInitial = {
  orderId?: string;
  contactId: string;
  sellerId: string;
  paymentMethod: string;
  installments: number;
  firstDueDays: number;
  intervalDays: number;
  discountTotal: number;
  freight: number;
  otherExpenses: number;
  carrier: string;
  shippingMode: string;
  freightPayer: string;
  billingAddress: string;
  shippingAddress: string;
  notes: string;
  internalNotes: string;
  validUntil: string;
  items: { productId: string; quantity: number; unitPrice: number; discountPct: number }[];
};

type Line = { key: string; productId: string; quantity: number; unitPrice: number; discountPct: number };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// Mesma fórmula do servidor (lineSubtotal): qtd × preço × (1 − desc%), em centavos.
const subtotalOf = (l: Line) => round2((l.quantity * l.unitPrice * (100 - l.discountPct)) / 100);

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

export function QuoteForm({
  action,
  contacts,
  products,
  sellers,
  ownScope,
  initial,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  contacts: QuoteFormContact[];
  products: QuoteFormProduct[];
  sellers: QuoteFormSeller[];
  ownScope: boolean;
  initial?: QuoteInitial;
}) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productBySku = useMemo(() => new Map(products.map((p) => [p.sku.toUpperCase(), p])), [products]);

  const [contactId, setContactId] = useState(initial?.contactId ?? "");
  const [contactQuery, setContactQuery] = useState("");
  const [sellerId, setSellerId] = useState(initial?.sellerId ?? "");
  const [billing, setBilling] = useState(initial?.billingAddress ?? "");
  const [shipping, setShipping] = useState(initial?.shippingAddress ?? "");
  const [lines, setLines] = useState<Line[]>(() => (initial?.items ?? []).map((i) => ({ ...i, key: newKey() })));
  const [productQuery, setProductQuery] = useState("");
  const [skuError, setSkuError] = useState<string | null>(null);
  const [discountTotal, setDiscountTotal] = useState(initial?.discountTotal ?? 0);
  const [freight, setFreight] = useState(initial?.freight ?? 0);
  const [otherExpenses, setOtherExpenses] = useState(initial?.otherExpenses ?? 0);

  const contact = contacts.find((c) => c.id === contactId) ?? null;
  const contactMatches = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return [];
    return contacts
      .filter((c) => `${c.label} ${c.person} ${c.cnpj ?? ""}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [contactQuery, contacts]);

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q)).slice(0, 12);
  }, [productQuery, products]);

  function pickContact(c: QuoteFormContact) {
    setContactId(c.id);
    setContactQuery("");
    if (!sellerId) setSellerId(c.ownerId);
    if (!billing && c.billingAddress) setBilling(c.billingAddress);
    if (!shipping && c.shippingAddress) setShipping(c.shippingAddress);
  }

  function addProduct(p: QuoteFormProduct, quantity = 1) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + quantity } : l));
      return [...prev, { key: newKey(), productId: p.id, quantity, unitPrice: p.price, discountPct: 0 }];
    });
    setProductQuery("");
    setSkuError(null);
  }

  /** Inclusão rápida: "SKU" ou "SKU*qtd" + Enter. */
  function quickAdd() {
    const raw = productQuery.trim();
    if (!raw) return;
    const [skuPart, qtyPart] = raw.split("*");
    const p = productBySku.get(skuPart.trim().toUpperCase());
    if (p) {
      const qty = Math.max(1, Math.floor(Number(qtyPart) || 1));
      addProduct(p, qty);
    } else if (productMatches.length === 1) {
      addProduct(productMatches[0]);
    } else {
      setSkuError(`SKU "${skuPart}" não encontrado.`);
    }
  }

  const update = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Após salvar, navegação completa para o pedido: router.push seguido do
  // router.refresh do ActionForm deixava a transição presa na tela atual.
  async function submit(fd: FormData): Promise<ClientActionResult> {
    const res = await action(fd);
    if (res.ok && res.redirectTo) {
      window.location.assign(res.redirectTo);
      return { ok: true, message: "Cotação salva. Abrindo..." };
    }
    return res;
  }

  const itemsTotal = round2(lines.reduce((s, l) => s + subtotalOf(l), 0));
  const total = round2(itemsTotal + freight + otherExpenses - discountTotal);

  return (
    <ActionForm action={submit} className="flex flex-col gap-4">
      {initial?.orderId && <input type="hidden" name="orderId" value={initial.orderId} />}
      <input type="hidden" name="contactId" value={contactId} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(lines.map(({ productId, quantity, unitPrice, discountPct }) => ({ productId, quantity, unitPrice, discountPct })))}
      />

      <Card title="Cliente">
        {contact ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">{contact.label}</p>
              <p className="text-xs text-ink-muted">
                {contact.person}
                {contact.cnpj ? ` · ${contact.cnpj}` : " · sem CPF/CNPJ (necessário para a NF-e)"}
              </p>
            </div>
            <button type="button" className={btnSecondary} onClick={() => setContactId("")}>
              Trocar cliente
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              placeholder="Buscar cliente por razão social, nome ou CNPJ"
              className={inputCls}
              aria-label="Buscar cliente"
            />
            {contactMatches.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gold-deep/40 bg-surface shadow-lg">
                {contactMatches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickContact(c)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      <span className="font-semibold text-ink">{c.label}</span>
                      <span className="text-xs text-ink-muted">
                        {c.person}
                        {c.cnpj ? ` · ${c.cnpj}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {contactQuery.trim() && contactMatches.length === 0 && (
              <p className="mt-1 text-xs text-ink-faint">Nenhum cliente encontrado na sua carteira.</p>
            )}
          </div>
        )}
        {!ownScope && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Vendedor">
              <select name="sellerId" value={sellerId} onChange={(e) => setSellerId(e.target.value)} className={inputCls}>
                <option value="">Dono da carteira do cliente</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </Card>

      <Card title="Itens">
        <div className="relative mb-3">
          <input
            value={productQuery}
            onChange={(e) => {
              setProductQuery(e.target.value);
              setSkuError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                quickAdd();
              }
            }}
            placeholder="Pesquisar SKU ou nome. Inclusão rápida: digite SKU (ou SKU*qtd) e Enter"
            className={inputCls}
            aria-label="Pesquisar produto"
          />
          {productMatches.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gold-deep/40 bg-surface shadow-lg">
              {productMatches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span>
                      <span className="font-semibold text-ink">{p.sku}</span> <span className="text-ink-muted">{p.name}</span>
                      {p.isKit && <span className="ml-1 text-[11px] text-gold">(kit)</span>}
                    </span>
                    <span className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
                      {fmtMoney(p.price)} · disp. {p.available}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {skuError && <p className="mt-1 text-xs text-critical">{skuError}</p>}
        </div>

        {lines.length === 0 ? (
          <p className="rounded-md border border-dashed border-gold-deep/40 px-4 py-6 text-center text-sm text-ink-muted">
            Nenhum item. Pesquise um produto acima.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Produto</th>
                  <th className={thCls}>Qtd</th>
                  <th className={thCls}>Preço unit.</th>
                  <th className={thCls}>Desc. %</th>
                  <th className={`${thCls} text-right`}>Subtotal</th>
                  <th className={thCls}>Disponível</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = productById.get(l.productId);
                  const effUnit = l.quantity > 0 ? subtotalOf(l) / l.quantity : 0;
                  const below = p?.minPrice !== null && p?.minPrice !== undefined && effUnit < p.minPrice;
                  const short = p ? l.quantity > p.available : false;
                  return (
                    <tr key={l.key}>
                      <td className={tdCls}>
                        <p className="font-semibold">{p?.sku ?? "?"}</p>
                        <p className="text-xs text-ink-muted">{p?.name}{p?.isKit ? " (kit)" : ""}</p>
                        {below && <p className="text-[11px] text-warning">Abaixo do preço mínimo: exigirá aprovação.</p>}
                      </td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={l.quantity}
                          onChange={(e) => update(l.key, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                          className={`${inputCls} w-24`}
                          aria-label="Quantidade"
                        />
                        <span className="ml-1 text-[11px] text-ink-faint">{p?.unit}</span>
                      </td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => update(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                          className={`${inputCls} w-28`}
                          aria-label="Preço unitário"
                        />
                      </td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={l.discountPct}
                          onChange={(e) => update(l.key, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                          className={`${inputCls} w-20`}
                          aria-label="Desconto percentual"
                        />
                      </td>
                      <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(subtotalOf(l))}</td>
                      <td className={`${tdCls} tabular-nums ${short ? "text-critical" : "text-good"}`}>
                        {p?.available ?? 0}
                        {short && <span className="block text-[11px]">insuficiente</span>}
                      </td>
                      <td className={tdCls}>
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          className="text-xs text-critical hover:underline"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Pagamento, frete e totais">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Forma de pagamento">
            <select name="paymentMethod" defaultValue={initial?.paymentMethod ?? ""} className={inputCls}>
              <option value="">A definir</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Parcelas">
            <input type="number" name="installments" min={1} max={24} defaultValue={initial?.installments ?? 1} className={inputCls} />
          </Field>
          <Field label="1º vencimento (dias)">
            <input type="number" name="firstDueDays" min={0} defaultValue={initial?.firstDueDays ?? 30} className={inputCls} />
          </Field>
          <Field label="Intervalo entre parcelas (dias)">
            <input type="number" name="intervalDays" min={1} defaultValue={initial?.intervalDays ?? 30} className={inputCls} />
          </Field>
          <Field label="Desconto no pedido (R$)">
            <input type="number" name="discountTotal" min={0} step="0.01" value={discountTotal} onChange={(e) => setDiscountTotal(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </Field>
          <Field label="Frete (R$)">
            <input type="number" name="freight" min={0} step="0.01" value={freight} onChange={(e) => setFreight(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </Field>
          <Field label="Outras despesas (R$)">
            <input type="number" name="otherExpenses" min={0} step="0.01" value={otherExpenses} onChange={(e) => setOtherExpenses(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </Field>
          <Field label="Validade da cotação">
            <input type="date" name="validUntil" defaultValue={initial?.validUntil ?? ""} className={inputCls} />
          </Field>
          <Field label="Transportadora">
            <input name="carrier" defaultValue={initial?.carrier ?? ""} className={inputCls} />
          </Field>
          <Field label="Modalidade de envio">
            <input name="shippingMode" defaultValue={initial?.shippingMode ?? ""} placeholder="Ex.: rodoviário, Sedex, retirada" className={inputCls} />
          </Field>
          <Field label="Frete por conta de">
            <select name="freightPayer" defaultValue={initial?.freightPayer ?? ""} className={inputCls}>
              <option value="">A definir</option>
              <option value="CIF">CIF (emitente)</option>
              <option value="FOB">FOB (destinatário)</option>
            </select>
          </Field>
        </div>

        <dl className="mt-4 ml-auto grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
          <dt className="text-ink-muted">Itens</dt>
          <dd className="text-right">{fmtMoney(itemsTotal)}</dd>
          <dt className="text-ink-muted">Frete + despesas</dt>
          <dd className="text-right">{fmtMoney(freight + otherExpenses)}</dd>
          <dt className="text-ink-muted">Desconto</dt>
          <dd className="text-right">- {fmtMoney(discountTotal)}</dd>
          <dt className="font-semibold text-ink">Total</dt>
          <dd className={`text-right font-bold ${total < 0 ? "text-critical" : "text-ink"}`}>{fmtMoney(total)}</dd>
        </dl>
        <p className="mt-2 text-right text-[11px] text-ink-faint">
          Tributos calculados pelo provedor fiscal na emissão. Os valores são recalculados no servidor ao salvar.
        </p>
      </Card>

      <Card title="Endereços e observações">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Endereço de faturamento">
            <textarea name="billingAddress" rows={2} value={billing} onChange={(e) => setBilling(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Endereço de entrega">
            <textarea name="shippingAddress" rows={2} value={shipping} onChange={(e) => setShipping(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Observações (aparecem para o cliente)">
            <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} className={inputCls} />
          </Field>
          <Field label="Observações internas">
            <textarea name="internalNotes" rows={3} defaultValue={initial?.internalNotes ?? ""} className={inputCls} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} disabled={!contactId || lines.length === 0}>
          Salvar cotação
        </button>
      </div>
    </ActionForm>
  );
}
