"use client";

import { useMemo, useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Field, inputCls, btnPrimary, btnSecondary, thCls, tdCls } from "@/components/erp/ui";

export type ProductOption = { id: string; sku: string; name: string; cost: number | null };
export type SupplierOption = { id: string; name: string; currency: string; country: string };

export type PurchaseValues = {
  id?: string;
  supplierId?: string;
  isImport?: boolean;
  currency?: string;
  exchangeRate?: number;
  freight?: number;
  insurance?: number;
  customsExpenses?: number;
  importTaxes?: number;
  otherExpenses?: number;
  costAllocation?: string;
  installments?: number;
  firstDueDays?: number;
  intervalDays?: number;
  expectedAt?: string;
  quoteNotes?: string | null;
  notes?: string | null;
  items?: { productId: string; quantity: number; unitCostForeign: number }[];
};

type Row = { key: number; productId: string; quantity: string; unitCostForeign: string };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PurchaseForm({
  action,
  products,
  suppliers,
  initial = {},
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  products: ProductOption[];
  suppliers: SupplierOption[];
  initial?: PurchaseValues;
}) {
  const [supplierId, setSupplierId] = useState(initial.supplierId ?? "");
  const [isImport, setIsImport] = useState(initial.isImport ?? false);
  const [currency, setCurrency] = useState(initial.currency ?? "BRL");
  const [rate, setRate] = useState(String(initial.exchangeRate ?? 1));
  const [expenses, setExpenses] = useState({
    freight: String(initial.freight ?? 0),
    insurance: String(initial.insurance ?? 0),
    customsExpenses: String(initial.customsExpenses ?? 0),
    importTaxes: String(initial.importTaxes ?? 0),
    otherExpenses: String(initial.otherExpenses ?? 0),
  });
  const [rows, setRows] = useState<Row[]>(
    (initial.items?.length ? initial.items : [{ productId: "", quantity: 1, unitCostForeign: 0 }]).map((i, k) => ({
      key: k,
      productId: i.productId,
      quantity: String(i.quantity),
      unitCostForeign: String(i.unitCostForeign),
    })),
  );
  const [search, setSearch] = useState("");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const filtered = search
    ? products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];
  const effRate = isImport ? Number(rate.replace(",", ".")) || 0 : 1;
  const goods = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitCostForeign.replace(",", ".")) || 0), 0);
  const expTotal = Object.values(expenses).reduce((s, v) => s + (Number(v.replace(",", ".")) || 0), 0);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addProduct = (p: ProductOption) => {
    setRows((rs) => {
      const blank = rs.find((r) => !r.productId);
      const cost = p.cost !== null && !isImport ? String(p.cost) : "0";
      if (blank) return rs.map((r) => (r.key === blank.key ? { ...r, productId: p.id, unitCostForeign: cost } : r));
      return [...rs, { key: Math.max(0, ...rs.map((r) => r.key)) + 1, productId: p.id, quantity: "1", unitCostForeign: cost }];
    });
    setSearch("");
  };

  const itemsJson = JSON.stringify(
    rows.filter((r) => r.productId).map((r) => ({
      productId: r.productId,
      quantity: r.quantity,
      unitCostForeign: r.unitCostForeign.replace(",", "."),
    })),
  );

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={itemsJson} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Fornecedor *" className="sm:col-span-2">
          <select
            name="supplierId"
            required
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              const s = suppliers.find((x) => x.id === e.target.value);
              if (s && s.currency !== "BRL") {
                setIsImport(true);
                setCurrency(s.currency);
              }
            }}
            className={inputCls}
          >
            <option value="">Selecione</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.country}, {s.currency})</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink">
          <input type="checkbox" name="isImport" checked={isImport} onChange={(e) => setIsImport(e.target.checked)} />
          Importação
        </label>
        <Field label="Previsão de entrega">
          <input type="date" name="expectedAt" defaultValue={initial.expectedAt ?? ""} className={inputCls} />
        </Field>
        {isImport && (
          <>
            <Field label="Moeda">
              <input name="currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputCls} />
            </Field>
            <Field label="Câmbio (R$ por 1 unidade)">
              <input name="exchangeRate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">Itens</p>
        <div className="relative mb-2 max-w-md">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por SKU ou nome para incluir"
            className={inputCls}
          />
          {filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gold-deep/40 bg-surface shadow-lg">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => addProduct(p)} className="w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-surface-2">
                    <span className="font-semibold">{p.sku}</span> · {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gold-deep/25">
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Produto</th>
                <th className={thCls}>Qtd</th>
                <th className={thCls}>Custo unit. ({isImport ? currency : "BRL"})</th>
                <th className={thCls}>Subtotal (R$)</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sub = (Number(r.quantity) || 0) * (Number(r.unitCostForeign.replace(",", ".")) || 0) * effRate;
                return (
                  <tr key={r.key}>
                    <td className={tdCls}>
                      <select value={r.productId} onChange={(e) => update(r.key, { productId: e.target.value })} className={inputCls}>
                        <option value="">Selecione</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className={tdCls}>
                      <input type="number" min={1} step={1} value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} className={`${inputCls} w-24`} />
                    </td>
                    <td className={tdCls}>
                      <input inputMode="decimal" value={r.unitCostForeign} onChange={(e) => update(r.key, { unitCostForeign: e.target.value })} className={`${inputCls} w-28`} />
                    </td>
                    <td className={`${tdCls} tabular-nums`}>{brl.format(sub)}</td>
                    <td className={tdCls}>
                      <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))} className="text-xs text-critical hover:underline">
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { key: Math.max(0, ...rs.map((x) => x.key)) + 1, productId: "", quantity: "1", unitCostForeign: "0" }])}
          className={`${btnSecondary} mt-2`}
        >
          Adicionar item
        </button>
        {byId.size === 0 && <p className="mt-2 text-xs text-ink-faint">Nenhum produto cadastrado nesta empresa.</p>}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">Despesas (R$) e rateio no custo</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["freight", "Frete"],
              ["insurance", "Seguro"],
              ["customsExpenses", "Despesas aduaneiras"],
              ["importTaxes", "Tributos de importação"],
              ["otherExpenses", "Outras despesas"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <input name={k} inputMode="decimal" value={expenses[k]} onChange={(e) => setExpenses((x) => ({ ...x, [k]: e.target.value }))} className={inputCls} />
            </Field>
          ))}
          <Field label="Critério de rateio">
            <select name="costAllocation" defaultValue={initial.costAllocation ?? "VALOR"} className={inputCls}>
              <option value="VALOR">Por valor</option>
              <option value="QUANTIDADE">Por quantidade</option>
              <option value="PESO">Por peso</option>
            </select>
          </Field>
        </div>
        <p className="mt-1 text-[11px] text-ink-faint">Critério de rateio a validar com a contabilidade. Sem peso cadastrado em algum item, o rateio por peso usa o valor.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Parcelas"><input name="installments" type="number" min={1} max={24} defaultValue={initial.installments ?? 1} className={inputCls} /></Field>
        <Field label="1º vencimento (dias após aprovação)"><input name="firstDueDays" type="number" min={0} defaultValue={initial.firstDueDays ?? 30} className={inputCls} /></Field>
        <Field label="Intervalo entre parcelas (dias)"><input name="intervalDays" type="number" min={1} defaultValue={initial.intervalDays ?? 30} className={inputCls} /></Field>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Field label="Cotações e comparação (fornecedor, preço, prazo, condição)">
          <textarea name="quoteNotes" rows={4} defaultValue={initial.quoteNotes ?? ""} className={inputCls} />
        </Field>
        <Field label="Observações">
          <textarea name="notes" rows={4} defaultValue={initial.notes ?? ""} className={inputCls} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-deep/25 bg-surface-2 p-3 text-sm">
        <div className="flex flex-wrap gap-4 tabular-nums">
          <span>Mercadorias: <b>{brl.format(goods * effRate)}</b></span>
          <span>Despesas: <b>{brl.format(expTotal)}</b></span>
          <span>Total estimado: <b>{brl.format(goods * effRate + expTotal)}</b></span>
        </div>
        <button className={btnPrimary}>{initial.id ? "Salvar alterações" : "Registrar solicitação"}</button>
      </div>
    </ActionForm>
  );
}
