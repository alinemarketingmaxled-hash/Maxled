import type { FinancialStatus } from "@/generated/prisma/client";
import { FIN_STATUS_LABELS } from "@/lib/erp/finance";
import { toDateInput } from "@/lib/erp/format";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Badge, Field, btnPrimary, inputCls, type Tone } from "@/components/erp/ui";

const TONES: Record<FinancialStatus, Tone> = { ABERTO: "info", PARCIAL: "warning", PAGO: "good", CANCELADO: "neutral" };

export function FinStatusBadge({ status, overdue }: { status: FinancialStatus; overdue?: boolean }) {
  if (overdue && (status === "ABERTO" || status === "PARCIAL")) {
    return <Badge tone="critical">Vencido{status === "PARCIAL" ? " (parcial)" : ""}</Badge>;
  }
  return <Badge tone={TONES[status]}>{FIN_STATUS_LABELS[status]}</Badge>;
}

export const PAYMENT_METHODS = ["PIX", "Boleto", "Transferência", "Cartão", "Dinheiro", "Cheque", "Compensação"];

export function startOfToday() {
  return new Date(new Date().setHours(0, 0, 0, 0));
}

/** Formulário de baixa (recebimento ou pagamento) — total ou parcial. */
export function PaymentForm({
  action,
  id,
  remaining,
  label,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  id: string;
  remaining: number;
  label: string;
}) {
  return (
    <ActionForm action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="id" value={id} />
      <Field label="Valor (R$)">
        <input name="amount" type="number" step="0.01" min="0.01" max={remaining} defaultValue={remaining.toFixed(2)} required className={inputCls} />
      </Field>
      <Field label="Data">
        <input name="paidAt" type="date" defaultValue={toDateInput(new Date())} required className={inputCls} />
      </Field>
      <Field label="Forma">
        <select name="method" className={inputCls} defaultValue="PIX">
          {PAYMENT_METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Observação">
        <input name="notes" className={inputCls} />
      </Field>
      <button className={`${btnPrimary} col-span-2 sm:col-span-1`}>{label}</button>
    </ActionForm>
  );
}

export function buildQuery(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
  return `/financeiro?${p.toString()}`;
}
