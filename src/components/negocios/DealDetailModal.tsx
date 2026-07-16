"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDealDetailAction,
  updateDealAction,
  deleteDealAction,
  type DealDetail,
} from "@/app/(app)/negocios/actions";
import { DealNotesTimeline } from "@/components/negocios/DealNotesTimeline";
import { DealScheduledMessages } from "@/components/negocios/DealScheduledMessages";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PAYMENT_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  PARCIAL: "Parcial",
  PAGO: "Pago",
};
const PAYMENT_CLASS: Record<string, string> = {
  PENDENTE: "bg-warning/15 text-warning",
  PARCIAL: "bg-gold/15 text-gold-bright",
  PAGO: "bg-good/15 text-good",
};

export function DealDetailModal({
  dealId,
  canEdit,
  onClose,
}: {
  dealId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  // undefined = still loading, null = fetched but not found/no permission.
  const [detail, setDetail] = useState<DealDetail | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const loading = detail === undefined;

  useEffect(() => {
    let cancelled = false;
    getDealDetailAction(dealId).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleDelete() {
    if (!detail || !confirm(`Excluir o negócio "${detail.name}"?`)) return;
    await deleteDealAction(dealId);
    onClose();
    router.refresh();
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    const formData = new FormData(e.currentTarget);
    let response;
    try {
      response = await updateDealAction(dealId, formData);
    } catch {
      setEditError("Não foi possível salvar agora. Tente novamente em instantes.");
      setSaving(false);
      return;
    }
    if (response.error) {
      setEditError(response.error);
      setSaving(false);
      return;
    }
    setDetail(await getDealDetailAction(dealId));
    setEditing(false);
    setSaving(false);
    router.refresh();
  }

  function handleClose() {
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gold-deep/40 bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          aria-label="Fechar"
          className="float-right text-lg leading-none text-ink-faint hover:text-ink"
        >
          ×
        </button>

        {loading && <p className="text-xs text-ink-faint">Carregando…</p>}
        {!loading && !detail && <p className="text-xs text-ink-faint">Negócio não encontrado.</p>}

        {detail && !editing && (
          <>
            <div className="mb-4 flex items-start justify-between gap-4 pr-6">
              <div>
                <h2 className="font-display text-lg text-ink">{detail.name}</h2>
                <p className="text-xs text-ink-muted">
                  {detail.contactName}
                  {detail.accountName ? ` — ${detail.accountName}` : ""}
                </p>
              </div>
              <div className="flex-none text-right">
                <div className="font-display text-xl text-gold-bright">{currency(detail.value)}</div>
                <div className="text-[11px] text-ink-faint">{detail.stageName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-dashed border-gold-deep/25 pt-3 text-[12.5px]">
              <div>
                <span className="text-ink-faint">Vendedor: </span>
                <span className="text-ink">{detail.ownerName}</span>
              </div>
              <div>
                <span className="text-ink-faint">Pagamento: </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${PAYMENT_CLASS[detail.paymentStatus]}`}
                >
                  {PAYMENT_LABEL[detail.paymentStatus]}
                </span>
                {detail.paymentMethod && (
                  <span className="ml-1.5 text-ink-faint">· {detail.paymentMethod}</span>
                )}
              </div>
              {detail.onTheWayDeadline && (
                <div>
                  <span className="text-ink-faint">Prazo (a caminho): </span>
                  <span className="text-warning">
                    {new Date(detail.onTheWayDeadline).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="mt-4 flex gap-2 border-t border-gold-deep/25 pt-4">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink hover:border-gold"
                >
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical"
                >
                  Excluir negócio
                </button>
              </div>
            )}

            <div className="mt-5 border-t border-gold-deep/25 pt-4">
              <DealScheduledMessages
                dealId={detail.id}
                messages={detail.scheduledMessages}
                canEdit={canEdit}
                onChanged={async () => setDetail(await getDealDetailAction(dealId))}
              />
            </div>

            <div className="mt-5 border-t border-gold-deep/25 pt-4">
              <DealNotesTimeline
                dealId={detail.id}
                notes={detail.notes}
                activityLogs={detail.activityLogs}
                canEdit={canEdit}
                onChanged={async () => setDetail(await getDealDetailAction(dealId))}
              />
            </div>
          </>
        )}

        {detail && editing && (
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-3 pr-6">
            <h2 className="mb-1 font-display text-lg text-ink">Editar negócio</h2>

            {editError && (
              <p className="rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{editError}</p>
            )}

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-faint">Nome do negócio</span>
              <input
                name="name"
                defaultValue={detail.name}
                required
                className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-faint">Valor (R$)</span>
              <input
                name="value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={detail.value}
                required
                className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-faint">Vendedor</span>
              <select
                name="ownerId"
                defaultValue={detail.ownerId}
                className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {detail.owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-faint">Estágio</span>
              <select
                name="stageId"
                defaultValue={detail.stageId}
                className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {detail.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-ink-faint">Status do pagamento</span>
                <select
                  name="paymentStatus"
                  defaultValue={detail.paymentStatus}
                  className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="PAGO">Pago</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-ink-faint">Forma de pagamento</span>
                <input
                  name="paymentMethod"
                  list="payment-methods"
                  defaultValue={detail.paymentMethod ?? ""}
                  placeholder="Ex.: Pix, boleto…"
                  className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
                />
                <datalist id="payment-methods">
                  <option value="À vista" />
                  <option value="Pix" />
                  <option value="Boleto" />
                  <option value="Cartão" />
                  <option value="Transferência" />
                  <option value="Parcelado" />
                </datalist>
              </label>
            </div>

            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditError(null);
                }}
                className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
