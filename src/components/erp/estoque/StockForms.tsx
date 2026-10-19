"use client";

import { useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Field, inputCls, btnPrimary, btnSecondary, thCls, tdCls } from "@/components/erp/ui";

type Action = (fd: FormData) => Promise<ClientActionResult>;

export function MovementForm({
  action,
  products,
  types,
}: {
  action: Action;
  products: { sku: string; name: string }[];
  types: { value: string; label: string }[];
}) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <datalist id="stock-skus">
        {products.map((p) => (
          <option key={p.sku} value={p.sku}>
            {p.name}
          </option>
        ))}
      </datalist>
      <Field label="SKU *">
        <input name="sku" list="stock-skus" required className={inputCls} />
      </Field>
      <Field label="Tipo *">
        <select name="type" className={inputCls}>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantidade *">
        <input name="quantity" type="number" min={1} required className={inputCls} />
      </Field>
      <Field label="Motivo *" className="sm:col-span-2 lg:col-span-3">
        <input name="reason" required placeholder="Ex.: avaria no recebimento, divergência de contagem" className={inputCls} />
      </Field>
      <Field label="Lote">
        <input name="lot" className={inputCls} />
      </Field>
      <Field label="Número de série">
        <input name="serial" className={inputCls} />
      </Field>
      <Field label="Documento de referência">
        <input name="documentRef" placeholder="NF, romaneio..." className={inputCls} />
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" className={btnPrimary}>
          Registrar movimento
        </button>
      </div>
    </ActionForm>
  );
}

export function InventoryCountForm({
  action,
  products,
}: {
  action: Action;
  products: { id: string; sku: string; name: string; physical: number; reserved: number }[];
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const divergences = products.filter((p) => counts[p.id] !== undefined && counts[p.id] !== "" && Number(counts[p.id]) !== p.physical);

  return (
    <ActionForm
      action={async (fd) => {
        const res = await action(fd);
        if (res.ok) setCounts({});
        return res;
      }}
      confirm={`Aplicar ${divergences.length} ajuste(s) de inventário?`}
      className="flex flex-col gap-3"
    >
      <div className="overflow-x-auto rounded-xl border border-gold-deep/25 bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className={thCls}>SKU</th>
              <th className={thCls}>Produto</th>
              <th className={`${thCls} text-right`}>Físico (sistema)</th>
              <th className={`${thCls} text-right`}>Contado</th>
              <th className={`${thCls} text-right`}>Diferença</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const v = counts[p.id];
              const diff = v === undefined || v === "" ? null : Number(v) - p.physical;
              return (
                <tr key={p.id} className={diff ? "bg-warning/10" : ""}>
                  <td className={`${tdCls} font-mono text-xs`}>{p.sku}</td>
                  <td className={tdCls}>{p.name}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{p.physical}</td>
                  <td className={`${tdCls} text-right`}>
                    <input
                      name={`count:${p.id}`}
                      type="number"
                      min={0}
                      value={v ?? ""}
                      onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
                      className={`${inputCls} w-24 text-right`}
                    />
                  </td>
                  <td className={`${tdCls} text-right tabular-nums ${diff ? (diff > 0 ? "text-good" : "text-critical") : ""}`}>
                    {diff === null ? "-" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">
        {divergences.length} divergência(s). Produtos sem contagem informada não são alterados. Contagem abaixo do reservado
        não é aceita: libere as reservas antes.
      </p>
      <div>
        <button type="submit" disabled={divergences.length === 0} className={btnPrimary}>
          Aplicar ajustes de inventário
        </button>
      </div>
    </ActionForm>
  );
}

export function TransferForm({ action, companies }: { action: Action; companies: { id: string; label: string }[] }) {
  const [rows, setRows] = useState([{ sku: "", qty: "" }]);
  return (
    <ActionForm
      action={async (fd) => {
        const res = await action(fd);
        if (res.ok) setRows([{ sku: "", qty: "" }]);
        return res;
      }}
      confirm="Confirmar a transferência entre empresas?"
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Empresa de destino *">
          <select name="toCompanyId" required className={inputCls}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Documento">
          <input name="documentRef" placeholder="NF de transferência" className={inputCls} />
        </Field>
        <Field label="Observações">
          <input name="notes" className={inputCls} />
        </Field>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
          <Field label="SKU">
            <input
              name="itemSku"
              list="stock-skus"
              value={r.sku}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))}
              className={inputCls}
            />
          </Field>
          <Field label="Quantidade">
            <input
              name="itemQty"
              type="number"
              min={1}
              value={r.qty}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
              className={inputCls}
            />
          </Field>
          <button type="button" className={btnSecondary} onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1}>
            Remover
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => setRows([...rows, { sku: "", qty: "" }])}>
          Adicionar item
        </button>
        <button type="submit" className={btnPrimary}>
          Transferir
        </button>
      </div>
    </ActionForm>
  );
}
