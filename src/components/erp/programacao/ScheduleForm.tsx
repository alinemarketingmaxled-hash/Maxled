"use client";

import { useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Card, Field, inputCls, btnPrimary, btnSecondary } from "@/components/erp/ui";

export type ScheduleFormInitial = {
  scheduleId?: string;
  contactId: string;
  responsibleId: string;
  title: string;
  frequencyDays: number;
  nextDate: string;
  action: string;
  conditions: string;
  notes: string;
  active: boolean;
  items: { productId: string; quantity: number }[];
};

type Option = { id: string; label: string };

export function ScheduleForm({
  action,
  contacts,
  products,
  users,
  ownScope,
  initial,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  contacts: Option[];
  products: Option[];
  users: Option[];
  ownScope: boolean;
  initial: ScheduleFormInitial;
}) {
  const [items, setItems] = useState(initial.items.length ? initial.items : [{ productId: "", quantity: 1 }]);

  // Navegação completa após salvar (ver QuoteForm: push + refresh do
  // ActionForm não concluía a troca de rota).
  async function submit(fd: FormData): Promise<ClientActionResult> {
    const res = await action(fd);
    if (res.ok && res.redirectTo) {
      window.location.assign(res.redirectTo);
      return { ok: true, message: "Programação salva." };
    }
    return res;
  }

  return (
    <ActionForm action={submit} className="flex flex-col gap-4">
      {initial.scheduleId && <input type="hidden" name="scheduleId" value={initial.scheduleId} />}
      <input type="hidden" name="items" value={JSON.stringify(items.filter((i) => i.productId && i.quantity > 0))} />
      <Card title="Programação">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Título *" className="sm:col-span-2 lg:col-span-1">
            <input name="title" required defaultValue={initial.title} placeholder="Ex.: Reposição mensal de LEDs" className={inputCls} />
          </Field>
          <Field label="Cliente *">
            <select name="contactId" required defaultValue={initial.contactId} className={inputCls}>
              <option value="">Selecione</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          {!ownScope && (
            <Field label="Responsável">
              <select name="responsibleId" defaultValue={initial.responsibleId} className={inputCls}>
                <option value="">Eu</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Periodicidade (dias) *">
            <input type="number" name="frequencyDays" min={1} max={3650} required defaultValue={initial.frequencyDays} className={inputCls} />
          </Field>
          <Field label="Próxima data *">
            <input type="date" name="nextDate" required defaultValue={initial.nextDate} className={inputCls} />
          </Field>
          <Field label="Ao vencer">
            <select name="action" defaultValue={initial.action} className={inputCls}>
              <option value="COTACAO">Gerar cotação (sem reservar estoque)</option>
              <option value="TAREFA">Criar tarefa para o responsável</option>
            </select>
          </Field>
          <Field label="Condições acordadas" className="sm:col-span-2">
            <input name="conditions" defaultValue={initial.conditions} placeholder="Preço, prazo, forma de pagamento..." className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink-muted">
            <input type="checkbox" name="active" defaultChecked={initial.active} /> Ativa
          </label>
          <Field label="Observações" className="sm:col-span-2 lg:col-span-3">
            <textarea name="notes" rows={2} defaultValue={initial.notes} className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card
        title="Produtos e quantidades"
        actions={
          <button type="button" className={btnSecondary} onClick={() => setItems((p) => [...p, { productId: "", quantity: 1 }])}>
            Adicionar produto
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <select
                value={it.productId}
                onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)))}
                className={inputCls}
                aria-label="Produto"
              >
                <option value="">Selecione o produto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={it.quantity}
                onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)))}
                className={inputCls}
                aria-label="Quantidade"
              />
              <button
                type="button"
                className="text-xs text-critical hover:underline"
                onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">A programação nunca baixa nem reserva estoque: gera previsão, tarefa ou cotação para revisão.</p>
      </Card>

      <div>
        <button className={btnPrimary}>Salvar programação</button>
      </div>
    </ActionForm>
  );
}
