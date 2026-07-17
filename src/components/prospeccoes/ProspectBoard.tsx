"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProspectAction,
  updateProspectAction,
  deleteProspectAction,
  saveStageValueAction,
  addProspectStageAction,
  submitActivationAction,
  approveActivationAction,
  rejectActivationAction,
} from "@/app/(app)/prospeccoes/actions";

export type StageValue = { stageId: string; date: string | null; note: string | null; done: boolean };
export type Activation = { id: string; status: "PENDENTE" | "APROVADO" | "RECUSADO"; rejectionReason: string | null };
export type ProspectRow = {
  id: string;
  ownerId: string;
  ownerName: string | null;
  name: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  temperature: "QUENTE" | "MORNO" | "FRIO";
  profile: string;
  notes: string | null;
  contactDate: string;
  lastTouchedAt: string;
  currentStageId: string;
  stageValues: StageValue[];
  activation: Activation | null;
};
export type ProspectStageDef = { id: string; name: string; order: number; isClientStage: boolean };
export type PendingActivation = {
  id: string;
  prospectName: string;
  clientName: string;
  ownerName: string | null;
  razaoSocial: string;
  cnpj: string;
  valor: number;
  condicaoPagamento: string;
  createdAt: string;
};

const TEMP_LABEL: Record<ProspectRow["temperature"], string> = { QUENTE: "Quente", MORNO: "Morno", FRIO: "Frio" };
const TEMP_CLASS: Record<ProspectRow["temperature"], string> = {
  QUENTE: "bg-critical/15 text-critical",
  MORNO: "bg-warning/15 text-warning",
  FRIO: "bg-surface-2 text-ink-faint",
};
const PROFILE_PRESETS = ["Indústria", "Pessoa física", "Distribuidor", "Outro"];
const ATRASO_DAYS = 7;

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : null;
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export type ProspectOwner = { id: string; name: string | null };

export function ProspectBoard({
  prospects,
  stages,
  isMediator,
  pendingActivations,
  owners,
}: {
  prospects: ProspectRow[];
  stages: ProspectStageDef[];
  isMediator: boolean;
  pendingActivations: PendingActivation[];
  owners: ProspectOwner[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [showAddStage, setShowAddStage] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [cell, setCell] = useState<{ prospect: ProspectRow; stage: ProspectStageDef } | null>(null);
  const [activationTarget, setActivationTarget] = useState<ProspectRow | null>(null);
  const [editTarget, setEditTarget] = useState<ProspectRow | null>(null);

  async function refresh() {
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">Prospecções</h3>
        <div className="flex items-center gap-2">
          {isMediator && pendingActivations.length > 0 && (
            <button
              onClick={() => setShowQueue(true)}
              className="rounded-lg border border-gold-deep px-3 py-1.5 text-xs font-semibold text-gold-bright hover:border-gold"
            >
              Aprovações pendentes ({pendingActivations.length})
            </button>
          )}
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright"
          >
            + Nova prospecção
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gold-deep/28 bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-gold-deep/30 bg-surface px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Cliente
              </th>
              {stages.map((s) => (
                <th
                  key={s.id}
                  className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint"
                >
                  {s.name}
                </th>
              ))}
              {isMediator && (
                <th className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2 text-left">
                  {!showAddStage ? (
                    <button
                      onClick={() => setShowAddStage(true)}
                      className="text-[10px] font-semibold text-gold-bright hover:underline"
                    >
                      + coluna
                    </button>
                  ) : (
                    <form
                      action={async (fd) => {
                        const r = await addProspectStageAction(fd);
                        if (!r.error) {
                          setShowAddStage(false);
                          await refresh();
                        }
                      }}
                      className="flex gap-1"
                    >
                      <input
                        name="name"
                        autoFocus
                        placeholder="Nome"
                        className="w-20 rounded border border-gold-deep/40 bg-surface-2 px-1.5 py-1 text-[11px] text-ink outline-none focus:border-gold"
                      />
                      <button type="submit" className="text-[10px] font-semibold text-gold-bright">
                        OK
                      </button>
                    </form>
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => {
              const atrasado = daysSince(p.lastTouchedAt) >= ATRASO_DAYS;
              return (
                <tr key={p.id} className={atrasado ? "bg-critical/[0.06]" : undefined}>
                  <td className="sticky left-0 z-10 border-b border-dashed border-gold-deep/18 bg-surface px-3 py-2.5 align-top">
                    <button onClick={() => setEditTarget(p)} className="block w-full text-left hover:opacity-80">
                      <div className="font-semibold text-ink">{p.clientName}</div>
                      <div className="text-[11px] text-ink-muted">
                        {p.name}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TEMP_CLASS[p.temperature]}`}>
                          {TEMP_LABEL[p.temperature]}
                        </span>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-faint">
                          {p.profile}
                        </span>
                        {atrasado && (
                          <span className="rounded-full bg-critical/15 px-1.5 py-0.5 text-[10px] font-semibold text-critical">
                            Atrasado
                          </span>
                        )}
                      </div>
                    </button>
                  </td>
                  {stages.map((s) => {
                    const value = p.stageValues.find((v) => v.stageId === s.id);
                    if (s.isClientStage) {
                      return (
                        <td key={s.id} className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2.5 align-top">
                          {!p.activation ? (
                            <button
                              onClick={() => setActivationTarget(p)}
                              className="text-left text-[11px] text-ink-faint hover:text-gold-bright hover:underline"
                            >
                              Tornar cliente ativo
                            </button>
                          ) : p.activation.status === "PENDENTE" ? (
                            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-warning">
                              Aguardando aprovação
                            </span>
                          ) : p.activation.status === "RECUSADO" ? (
                            <div>
                              <span className="rounded-full bg-critical/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-critical">
                                Recusado
                              </span>
                              {p.activation.rejectionReason && (
                                <p className="mt-1 text-[10.5px] text-ink-faint">{p.activation.rejectionReason}</p>
                              )}
                              <button
                                onClick={() => setActivationTarget(p)}
                                className="mt-1 text-[10.5px] text-gold-bright hover:underline"
                              >
                                Corrigir e reenviar
                              </button>
                            </div>
                          ) : (
                            <span className="rounded-full bg-good/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-good">
                              Convertido ✓
                            </span>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td key={s.id} className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2.5 align-top">
                        <button
                          onClick={() => setCell({ prospect: p, stage: s })}
                          className="block w-full text-left hover:opacity-80"
                        >
                          {value?.date || value?.note ? (
                            <div className="text-[11.5px] leading-snug">
                              <div className="text-ink-muted">
                                Data: {formatDate(value.date) ?? "—"} {value.done && <span className="text-good">✔</span>}
                              </div>
                              <div className="truncate text-ink-faint">Obs.: {value.note || "—"}</div>
                            </div>
                          ) : (
                            <div className="text-[11.5px] leading-snug text-ink-faint">
                              <div>Data</div>
                              <div>Obs.:</div>
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  {isMediator && <td className="border-b border-l border-dashed border-gold-deep/18" />}
                </tr>
              );
            })}
            {prospects.length === 0 && (
              <tr>
                <td colSpan={stages.length + 2} className="px-3 py-6 text-center text-xs text-ink-faint">
                  Nenhuma prospecção ainda. Clique em &ldquo;+ Nova prospecção&rdquo; pra começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewProspectModal
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            setShowNew(false);
            await refresh();
          }}
        />
      )}

      {editTarget && (
        <EditProspectModal
          prospect={editTarget}
          owners={owners}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null);
            await refresh();
          }}
          onDeleted={async () => {
            setEditTarget(null);
            await refresh();
          }}
        />
      )}

      {cell && (
        <StageCellModal
          prospect={cell.prospect}
          stage={cell.stage}
          onClose={() => setCell(null)}
          onSaved={async () => {
            setCell(null);
            await refresh();
          }}
        />
      )}

      {activationTarget && (
        <ActivationModal
          prospect={activationTarget}
          onClose={() => setActivationTarget(null)}
          onSaved={async () => {
            setActivationTarget(null);
            await refresh();
          }}
        />
      )}

      {showQueue && (
        <ActivationQueueModal
          items={pendingActivations}
          onClose={() => setShowQueue(false)}
          onChanged={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-gold-deep/40 bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="font-display text-base text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-lg leading-none text-ink-faint hover:text-ink">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold";

function NewProspectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const r = await createProspectAction(fd);
    if (r.error) {
      setError(r.error);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell title="Nova prospecção" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {error && <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-xs text-critical">{error}</p>}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Nome do contato</span>
          <input name="name" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Cliente / empresa</span>
          <input name="clientName" required className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Número</span>
            <input name="phone" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">E-mail</span>
            <input name="email" type="email" className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Status</span>
            <select name="temperature" defaultValue="MORNO" className={inputClass}>
              <option value="QUENTE">Quente</option>
              <option value="MORNO">Morno</option>
              <option value="FRIO">Frio</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Perfil</span>
            <input name="profile" list="profile-presets" required className={inputClass} />
            <datalist id="profile-presets">
              {PROFILE_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Data</span>
          <input name="contactDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Observação</span>
          <textarea name="notes" rows={2} className={inputClass} />
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditProspectModal({
  prospect,
  owners,
  onClose,
  onSaved,
  onDeleted,
}: {
  prospect: ProspectRow;
  owners: ProspectOwner[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const r = await updateProspectAction(prospect.id, fd);
    if (r.error) {
      setError(r.error);
      setSaving(false);
      return;
    }
    onSaved();
  }

  async function handleDelete() {
    if (!confirm(`Excluir a prospecção de "${prospect.clientName}"?`)) return;
    setDeleting(true);
    const r = await deleteProspectAction(prospect.id);
    if (r.error) {
      setError(r.error);
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  return (
    <ModalShell title={`Editar — ${prospect.clientName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {error && <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-xs text-critical">{error}</p>}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Nome do contato</span>
          <input name="name" required defaultValue={prospect.name} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Cliente / empresa</span>
          <input name="clientName" required defaultValue={prospect.clientName} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Número</span>
            <input name="phone" defaultValue={prospect.phone ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">E-mail</span>
            <input name="email" type="email" defaultValue={prospect.email ?? ""} className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Status</span>
            <select name="temperature" defaultValue={prospect.temperature} className={inputClass}>
              <option value="QUENTE">Quente</option>
              <option value="MORNO">Morno</option>
              <option value="FRIO">Frio</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Perfil</span>
            <input name="profile" list="profile-presets-edit" required defaultValue={prospect.profile} className={inputClass} />
            <datalist id="profile-presets-edit">
              {PROFILE_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
        </div>
        {owners.length > 1 && (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Vendedor</span>
            <select name="ownerId" defaultValue={prospect.ownerId} className={inputClass}>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Data</span>
          <input name="contactDate" type="date" required defaultValue={prospect.contactDate.slice(0, 10)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Observação</span>
          <textarea name="notes" rows={2} defaultValue={prospect.notes ?? ""} className={inputClass} />
        </label>
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical disabled:opacity-60"
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function StageCellModal({
  prospect,
  stage,
  onClose,
  onSaved,
}: {
  prospect: ProspectRow;
  stage: ProspectStageDef;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = prospect.stageValues.find((v) => v.stageId === stage.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const r = await saveStageValueAction(prospect.id, stage.id, fd);
    if (r.error) {
      setError(r.error);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell title={`${stage.name} — ${prospect.clientName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {error && <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-xs text-critical">{error}</p>}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Data</span>
          <input name="date" type="date" defaultValue={existing?.date?.slice(0, 10) ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Observação</span>
          <textarea name="note" rows={3} defaultValue={existing?.note ?? ""} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input name="done" type="checkbox" defaultChecked={existing?.done ?? false} className="h-3.5 w-3.5" />
          Concluído
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ActivationModal({
  prospect,
  onClose,
  onSaved,
}: {
  prospect: ProspectRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const r = await submitActivationAction(prospect.id, fd);
    if (r.error) {
      setError(r.error);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell title={`Tornar cliente ativo — ${prospect.clientName}`} onClose={onClose}>
      <p className="mb-2.5 text-[11px] text-ink-faint">
        Mesmos dados do Sintegra. Depois de enviar, um mediador precisa aprovar antes do cliente e a negociação
        aparecerem em Clientes/Negócios.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {error && <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-xs text-critical">{error}</p>}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Razão social</span>
          <input name="razaoSocial" required defaultValue={prospect.clientName} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">CNPJ</span>
          <input name="cnpj" required className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">E-mail financeiro</span>
            <input name="emailFinanceiro" type="email" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">E-mail NF-e</span>
            <input name="emailNfe" type="email" required className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Inscrição estadual</span>
          <input name="inscricaoEstadual" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Endereço de faturamento</span>
          <textarea name="enderecoFaturamento" rows={2} required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Endereço de entrega</span>
          <textarea name="enderecoEntrega" rows={2} required className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Valor (R$)</span>
            <input name="valor" type="number" step="0.01" min="0" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Condição de pagamento</span>
            <input name="condicaoPagamento" required placeholder="Ex.: 30/60/90 dias" className={inputClass} />
          </label>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
          >
            {saving ? "Enviando…" : "Enviar para aprovação"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ActivationQueueModal({
  items,
  onClose,
  onChanged,
}: {
  items: PendingActivation[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setBusy(id);
    await approveActivationAction(id);
    setBusy(null);
    onChanged();
  }

  async function handleReject(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setBusy(id);
    const fd = new FormData(e.currentTarget);
    await rejectActivationAction(id, fd);
    setBusy(null);
    setRejecting(null);
    onChanged();
  }

  return (
    <ModalShell title="Aprovações pendentes" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-xs text-ink-faint">Nada pendente.</p>}
        {items.map((it) => (
          <div key={it.id} className="rounded-lg border border-gold-deep/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{it.razaoSocial}</div>
                <div className="text-[11px] text-ink-muted">
                  {it.prospectName} · {it.clientName} · vendedor {it.ownerName}
                </div>
                <div className="text-[11px] text-ink-faint">
                  CNPJ {it.cnpj} · {currency(it.valor)} · {it.condicaoPagamento}
                </div>
              </div>
              <div className="flex flex-none gap-1.5">
                <button
                  onClick={() => handleApprove(it.id)}
                  disabled={busy === it.id}
                  className="rounded-md bg-good/20 px-2.5 py-1 text-[11px] font-semibold text-good hover:bg-good/30 disabled:opacity-60"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => setRejecting(rejecting === it.id ? null : it.id)}
                  className="rounded-md bg-critical/15 px-2.5 py-1 text-[11px] font-semibold text-critical hover:bg-critical/25"
                >
                  Recusar
                </button>
              </div>
            </div>
            {rejecting === it.id && (
              <form onSubmit={(e) => handleReject(e, it.id)} className="mt-2 flex gap-2">
                <input
                  name="reason"
                  required
                  placeholder="Motivo da recusa (o vendedor vai ver)"
                  className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={busy === it.id}
                  className="rounded-md bg-gold-solid px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
                >
                  Confirmar
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
