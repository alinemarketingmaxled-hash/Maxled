"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addInstallmentAction,
  generateInstallmentsAction,
  toggleInstallmentAction,
  deleteInstallmentAction,
} from "@/app/(app)/negocios/actions";

export type Installment = { id: string; number: number; value: number; dueDate: string; paid: boolean };

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function DealInstallments({
  dealId,
  installments,
  canEdit,
  onChanged,
}: {
  dealId: string;
  installments: Installment[];
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [count, setCount] = useState("");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  async function refresh() {
    router.refresh();
    await onChanged?.();
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!value || !dueDate || saving) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("value", value);
    fd.set("dueDate", dueDate);
    const response = await addInstallmentAction(dealId, fd);
    if (response.error) {
      setError(response.error);
      setSaving(false);
      return;
    }
    setValue("");
    setDueDate("");
    setSaving(false);
    await refresh();
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!count || !firstDueDate || saving) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("count", count);
    fd.set("firstDueDate", firstDueDate);
    const response = await generateInstallmentsAction(dealId, fd);
    if (response.error) {
      setError(response.error);
      setSaving(false);
      return;
    }
    setCount("");
    setFirstDueDate("");
    setShowGenerate(false);
    setSaving(false);
    await refresh();
  }

  async function handleToggle(id: string) {
    await toggleInstallmentAction(id);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteInstallmentAction(id);
    await refresh();
  }

  const totalValue = installments.reduce((s, i) => s + i.value, 0);
  const totalPaid = installments.filter((i) => i.paid).reduce((s, i) => s + i.value, 0);

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">Parcelas</h3>

      {installments.length > 0 && (
        <div className="mb-2 flex gap-4 text-[11px] text-ink-muted">
          <span>
            Total <b className="text-ink">{currency(totalValue)}</b>
          </span>
          <span>
            Pago <b className="text-good">{currency(totalPaid)}</b>
          </span>
          <span>
            Pendente <b className="text-warning">{currency(totalValue - totalPaid)}</b>
          </span>
        </div>
      )}

      {canEdit && (
        <div className="mb-3 flex flex-col gap-2">
          {error && (
            <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-[11px] text-critical">{error}</p>
          )}
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="Valor da parcela"
              className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gold-solid px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
            >
              Adicionar
            </button>
          </form>

          {!showGenerate ? (
            <button
              type="button"
              onClick={() => setShowGenerate(true)}
              className="self-start text-[11px] text-gold-bright hover:underline"
            >
              Dividir o valor do negócio em parcelas iguais
            </button>
          ) : (
            <form onSubmit={handleGenerate} className="flex items-center gap-2">
              <span className="text-[11px] text-ink-faint">Gerar</span>
              <input
                value={count}
                onChange={(e) => setCount(e.target.value)}
                type="number"
                min="1"
                max="60"
                placeholder="Nº"
                className="w-16 rounded-md border border-gold-deep/40 bg-surface-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
              <span className="text-[11px] text-ink-faint">parcelas iguais a partir de</span>
              <input
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
                type="date"
                className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gold-solid px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
              >
                Gerar
              </button>
              <button
                type="button"
                onClick={() => setShowGenerate(false)}
                className="text-[11px] text-ink-faint hover:text-ink"
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {installments.map((i) => (
          <li
            key={i.id}
            className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-xs ${
              i.paid ? "bg-good/10" : "bg-surface-2"
            }`}
          >
            <div className="min-w-0">
              <span className="font-semibold text-ink">Parcela {i.number}</span>{" "}
              <span className="text-ink-muted">{currency(i.value)}</span>
              <div className="text-[10px] text-ink-faint">Vence em {formatDate(i.dueDate)}</div>
            </div>
            {canEdit && (
              <div className="flex flex-none items-center gap-2">
                <button
                  onClick={() => handleToggle(i.id)}
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    i.paid ? "bg-good/20 text-good" : "bg-warning/15 text-warning"
                  }`}
                >
                  {i.paid ? "Pago" : "Pendente"}
                </button>
                <button onClick={() => handleDelete(i.id)} className="text-ink-faint hover:text-critical">
                  ×
                </button>
              </div>
            )}
          </li>
        ))}
        {installments.length === 0 && (
          <li className="text-xs text-ink-faint">Nenhuma parcela cadastrada.</li>
        )}
      </ul>
    </div>
  );
}
