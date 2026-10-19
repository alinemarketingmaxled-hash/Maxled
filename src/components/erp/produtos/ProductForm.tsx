"use client";

import { useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Card, Field, inputCls, btnPrimary, btnSecondary } from "@/components/erp/ui";

export type ProductFormValues = {
  id?: string;
  sku: string;
  barcode: string;
  manufacturerCode: string;
  name: string;
  description: string;
  technicalSpecs: string;
  family: string;
  category: string;
  brand: string;
  unit: string;
  kind: string;
  packQty: number;
  ncm: string;
  cest: string;
  origin: number;
  price: string;
  minPrice: string;
  cost: string;
  minStock: number;
  reorderQty: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  imageUrl: string;
  datasheetUrl: string;
  active: boolean;
  kit: { sku: string; quantity: number }[];
  suppliers: { supplierId: string; supplierSku: string; lastCost: string; leadTimeDays: string }[];
};

export function ProductForm({
  action,
  values,
  families,
  kinds,
  origins,
  componentOptions,
  supplierOptions,
  canEditPrices,
  canEditCosts,
  canSeeCosts,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  values: ProductFormValues;
  families: string[];
  kinds: { value: string; label: string }[];
  origins: { value: number; label: string }[];
  componentOptions: { sku: string; name: string }[];
  supplierOptions: { id: string; name: string }[];
  canEditPrices: boolean;
  canEditCosts: boolean;
  canSeeCosts: boolean;
}) {
  const [kit, setKit] = useState(values.kit);
  const [suppliers, setSuppliers] = useState(values.suppliers);

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Card title="Identificação">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SKU *">
            <input name="sku" required defaultValue={values.sku} className={inputCls} />
          </Field>
          <Field label="Código de barras">
            <input name="barcode" defaultValue={values.barcode} className={inputCls} />
          </Field>
          <Field label="Código do fabricante">
            <input name="manufacturerCode" defaultValue={values.manufacturerCode} className={inputCls} />
          </Field>
          <Field label="Nome *" className="sm:col-span-2">
            <input name="name" required defaultValue={values.name} className={inputCls} />
          </Field>
          <Field label="Família">
            <select name="family" defaultValue={values.family} className={inputCls}>
              {families.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Categoria">
            <input name="category" defaultValue={values.category} className={inputCls} />
          </Field>
          <Field label="Marca">
            <input name="brand" defaultValue={values.brand} className={inputCls} />
          </Field>
          <Field label="Unidade">
            <input name="unit" defaultValue={values.unit} className={inputCls} />
          </Field>
          <Field label="Tipo">
            <select name="kind" defaultValue={values.kind} className={inputCls}>
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantidade por pacote/caixa">
            <input name="packQty" type="number" min={1} defaultValue={values.packQty} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink">
            <input type="checkbox" name="active" defaultChecked={values.active} /> Ativo
          </label>
          <Field label="Descrição técnica" className="sm:col-span-2 lg:col-span-3">
            <textarea name="description" rows={2} defaultValue={values.description} className={inputCls} />
          </Field>
          <Field label="Especificações eletrônicas / ficha técnica" className="sm:col-span-2 lg:col-span-3">
            <textarea name="technicalSpecs" rows={3} defaultValue={values.technicalSpecs} className={inputCls} />
          </Field>
          <Field label="URL da foto">
            <input name="imageUrl" defaultValue={values.imageUrl} className={inputCls} />
          </Field>
          <Field label="URL da ficha técnica (PDF)">
            <input name="datasheetUrl" defaultValue={values.datasheetUrl} className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card title="Dados fiscais">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="NCM (8 dígitos)">
            <input name="ncm" inputMode="numeric" defaultValue={values.ncm} className={inputCls} />
          </Field>
          <Field label="CEST (quando aplicável)">
            <input name="cest" inputMode="numeric" defaultValue={values.cest} className={inputCls} />
          </Field>
          <Field label="Origem">
            <select name="origin" defaultValue={values.origin} className={inputCls}>
              {origins.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Preços, custos e estoque">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Preço de venda (R$)">
            <input name="price" inputMode="decimal" defaultValue={values.price} disabled={!canEditPrices} className={inputCls} />
          </Field>
          <Field label="Preço mínimo (abaixo exige aprovação)">
            <input name="minPrice" inputMode="decimal" defaultValue={values.minPrice} disabled={!canEditPrices} className={inputCls} />
          </Field>
          {canSeeCosts && (
            <Field label="Custo (R$)">
              <input name="cost" inputMode="decimal" defaultValue={values.cost} disabled={!canEditCosts} className={inputCls} />
            </Field>
          )}
          <Field label="Estoque mínimo">
            <input name="minStock" type="number" min={0} defaultValue={values.minStock} className={inputCls} />
          </Field>
          <Field label="Quantidade de reposição">
            <input name="reorderQty" type="number" min={0} defaultValue={values.reorderQty} className={inputCls} />
          </Field>
        </div>
        {!canEditPrices && (
          <p className="mt-2 text-[11px] text-ink-faint">Seu perfil não altera valores financeiros: preços e custos ficam como estão.</p>
        )}
      </Card>

      <Card title="Embalagem e logística">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Peso (kg)">
            <input name="weightKg" inputMode="decimal" defaultValue={values.weightKg} className={inputCls} />
          </Field>
          <Field label="Comprimento (cm)">
            <input name="lengthCm" inputMode="decimal" defaultValue={values.lengthCm} className={inputCls} />
          </Field>
          <Field label="Largura (cm)">
            <input name="widthCm" inputMode="decimal" defaultValue={values.widthCm} className={inputCls} />
          </Field>
          <Field label="Altura (cm)">
            <input name="heightCm" inputMode="decimal" defaultValue={values.heightCm} className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card
        title="Componentes do kit"
        actions={
          <button type="button" className={btnSecondary} onClick={() => setKit([...kit, { sku: "", quantity: 1 }])}>
            Adicionar componente
          </button>
        }
      >
        <p className="mb-2 text-[11.5px] text-ink-faint">
          Com componentes, o produto não tem saldo próprio: vender 1 kit baixa as quantidades abaixo de cada SKU.
        </p>
        <datalist id="component-skus">
          {componentOptions.map((c) => (
            <option key={c.sku} value={c.sku}>
              {c.name}
            </option>
          ))}
        </datalist>
        {kit.length === 0 && <p className="text-xs text-ink-muted">Produto simples (sem componentes).</p>}
        <div className="flex flex-col gap-2">
          {kit.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
              <Field label="SKU do componente">
                <input
                  name="kitSku"
                  list="component-skus"
                  value={row.sku}
                  onChange={(e) => setKit(kit.map((r, j) => (j === i ? { ...r, sku: e.target.value } : r)))}
                  className={inputCls}
                />
              </Field>
              <Field label="Qtd. por kit">
                <input
                  name="kitQty"
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => setKit(kit.map((r, j) => (j === i ? { ...r, quantity: Number(e.target.value) } : r)))}
                  className={inputCls}
                />
              </Field>
              <button type="button" className={btnSecondary} onClick={() => setKit(kit.filter((_, j) => j !== i))}>
                Remover
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Fornecedores"
        actions={
          supplierOptions.length > 0 && (
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setSuppliers([...suppliers, { supplierId: supplierOptions[0].id, supplierSku: "", lastCost: "", leadTimeDays: "" }])}
            >
              Vincular fornecedor
            </button>
          )
        }
      >
        {supplierOptions.length === 0 && <p className="text-xs text-ink-muted">Nenhum fornecedor cadastrado nesta empresa.</p>}
        <div className="flex flex-col gap-2">
          {suppliers.map((row, i) => {
            const update = (patch: Partial<typeof row>) => setSuppliers(suppliers.map((r, j) => (j === i ? { ...r, ...patch } : r)));
            return (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
                <Field label="Fornecedor">
                  <select name="supId" value={row.supplierId} onChange={(e) => update({ supplierId: e.target.value })} className={inputCls}>
                    {supplierOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Código no fornecedor">
                  <input name="supSku" value={row.supplierSku} onChange={(e) => update({ supplierSku: e.target.value })} className={inputCls} />
                </Field>
                {canSeeCosts ? (
                  <Field label="Último custo">
                    <input
                      name="supCost"
                      inputMode="decimal"
                      value={row.lastCost}
                      readOnly={!canEditCosts}
                      onChange={(e) => update({ lastCost: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                ) : (
                  <input type="hidden" name="supCost" value="" />
                )}
                <Field label="Prazo (dias)">
                  <input name="supLead" type="number" min={0} value={row.leadTimeDays} onChange={(e) => update({ leadTimeDays: e.target.value })} className={inputCls} />
                </Field>
                <button type="button" className={btnSecondary} onClick={() => setSuppliers(suppliers.filter((_, j) => j !== i))}>
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <button type="submit" className={btnPrimary}>
          Salvar produto
        </button>
      </div>
    </ActionForm>
  );
}
