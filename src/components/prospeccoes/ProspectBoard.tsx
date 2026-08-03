"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProspectAction,
  updateProspectAction,
  deleteProspectAction,
  saveStageValueAction,
  submitActivationAction,
  approveActivationAction,
  rejectActivationAction,
  scheduleTaskAction,
  addProspectStageAction,
  renameProspectStageAction,
  deleteProspectStageAction,
  markActivationDecisionsSeenAction,
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
export type ProspectStageDef = {
  id: string;
  name: string;
  order: number;
  isClientStage: boolean;
  isCustom: boolean;
  category: string;
};
export type DecidedActivationNotice = {
  id: string;
  clientName: string;
  status: "APROVADO" | "RECUSADO";
  rejectionReason: string | null;
};
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

/** Columns unlock left-to-right: a stage is available once the previous
 * one (by order) has been marked done for that prospect. "Cliente Ativo" is
 * exempt — it stays a visible button on every prospect, since a deal can
 * close out of order and shouldn't be hidden behind the sequence. Custom
 * columns (added beyond the 6 fixed ones) are supplementary tracking a
 * seller sets up for themselves, so they're always open too. */
function isStageUnlocked(prospect: ProspectRow, stage: ProspectStageDef, stages: ProspectStageDef[]) {
  if (stage.isClientStage || stage.isCustom) return true;
  const idx = stages.findIndex((s) => s.id === stage.id);
  if (idx <= 0) return true;
  const prevStage = stages[idx - 1];
  const prevValue = prospect.stageValues.find((v) => v.stageId === prevStage.id);
  return prevValue?.done ?? false;
}

/** Groups consecutive stages sharing the same category into header spans —
 * stage order is fixed left-to-right, so same-category stages are always
 * contiguous (the 6 fixed stages) or trail off together (custom columns,
 * all "Outros"). */
function buildCategoryGroups(stages: ProspectStageDef[]) {
  const groups: { category: string; span: number }[] = [];
  for (const s of stages) {
    const last = groups[groups.length - 1];
    if (last && last.category === s.category) last.span += 1;
    else groups.push({ category: s.category, span: 1 });
  }
  return groups;
}

export type ProspectOwner = { id: string; name: string | null };

export type OpenDeal = { id: string; label: string };

export function ProspectBoard({
  prospects,
  stages,
  isMediator,
  pendingActivations,
  owners,
  openDeals,
  decidedNotices,
}: {
  prospects: ProspectRow[];
  stages: ProspectStageDef[];
  isMediator: boolean;
  pendingActivations: PendingActivation[];
  owners: ProspectOwner[];
  openDeals: OpenDeal[];
  decidedNotices: DecidedActivationNotice[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [cell, setCell] = useState<{ prospect: ProspectRow; stage: ProspectStageDef } | null>(null);
  const [activationTarget, setActivationTarget] = useState<ProspectRow | null>(null);
  const [editTarget, setEditTarget] = useState<ProspectRow | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumnBusy, setAddingColumnBusy] = useState(false);
  const [missingStageFilter, setMissingStageFilter] = useState("");
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(new Set());

  // Marks the seller's newly-decided (aprovado/recusado) activation
  // requests as seen once the board actually renders in the browser — same
  // pattern as MarkSocialSeen for Comunicados. Doesn't router.refresh(): the
  // banner should stay visible for this visit even after it's marked seen,
  // it just won't come back on the next page load.
  useEffect(() => {
    if (decidedNotices.length > 0) markActivationDecisionsSeenAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryGroups = useMemo(() => buildCategoryGroups(stages), [stages]);
  const filterableStages = stages.filter((s) => !s.isClientStage);
  const visibleProspects = missingStageFilter
    ? prospects.filter((p) => !p.stageValues.find((v) => v.stageId === missingStageFilter)?.done)
    : prospects;
  const visibleNotices = decidedNotices.filter((n) => !dismissedNotices.has(n.id));

  async function refresh() {
    router.refresh();
  }

  async function handleAddColumn() {
    if (!newColumnName.trim()) return;
    setAddingColumnBusy(true);
    const fd = new FormData();
    fd.set("name", newColumnName);
    await addProspectStageAction(fd);
    setNewColumnName("");
    setAddingColumn(false);
    setAddingColumnBusy(false);
    await refresh();
  }

  return (
    <div>
      {visibleNotices.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {visibleNotices.map((n) => (
            <div
              key={n.id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-[12.5px] ${
                n.status === "APROVADO"
                  ? "border-good/40 bg-good/10 text-good"
                  : "border-critical/40 bg-critical/10 text-critical"
              }`}
            >
              <span>
                {n.status === "APROVADO"
                  ? `"${n.clientName}" foi aceito como cliente ativo! ✓`
                  : `"${n.clientName}" foi recusado como cliente.${n.rejectionReason ? ` Motivo: ${n.rejectionReason}` : ""}`}
              </span>
              <button
                onClick={() => setDismissedNotices((prev) => new Set(prev).add(n.id))}
                aria-label="Dispensar aviso"
                className="text-lg leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">Prospecções</h3>
        <div className="flex items-center gap-2">
          <select
            value={missingStageFilter}
            onChange={(e) => setMissingStageFilter(e.target.value)}
            className="rounded-lg border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
          >
            <option value="">Falta: todas as etapas</option>
            {filterableStages.map((s) => (
              <option key={s.id} value={s.id}>
                Falta: {s.name}
              </option>
            ))}
          </select>
          {isMediator && pendingActivations.length > 0 && (
            <button
              onClick={() => setShowQueue(true)}
              className="rounded-lg border border-gold-deep px-3 py-1.5 text-xs font-semibold text-gold-bright hover:border-gold"
            >
              Aprovações pendentes ({pendingActivations.length})
            </button>
          )}
          <button
            onClick={() => setShowSchedule(true)}
            className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink hover:border-gold"
          >
            + Agendar
          </button>
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
              <th className="sticky left-0 z-10 border-b border-gold-deep/20 bg-surface px-3 py-1" />
              {categoryGroups.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className="border-b border-l border-dashed border-gold-deep/18 bg-surface-2/40 px-3 py-1 text-center text-[9.5px] font-semibold uppercase tracking-wide text-gold-bright/80"
                >
                  {g.category}
                </th>
              ))}
              <th className="border-b border-l border-dashed border-gold-deep/18" />
            </tr>
            <tr>
              <th className="sticky left-0 z-10 border-b border-gold-deep/30 bg-surface px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Cliente
              </th>
              {stages.map((s) =>
                s.isCustom ? (
                  <CustomStageHeaderCell key={s.id} stage={s} onChanged={refresh} />
                ) : (
                  <th
                    key={s.id}
                    className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {s.name}
                  </th>
                ),
              )}
              <th className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                {addingColumn ? (
                  <div className="flex items-center gap-1 normal-case">
                    <input
                      autoFocus
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                      placeholder="Nome da coluna"
                      className="w-28 rounded-md border border-gold bg-surface-2 px-1.5 py-1 text-[11px] font-normal text-ink outline-none"
                    />
                    <button
                      onClick={handleAddColumn}
                      disabled={addingColumnBusy}
                      className="text-[11px] font-semibold text-gold-bright hover:underline disabled:opacity-60"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setAddingColumn(false);
                        setNewColumnName("");
                      }}
                      className="text-[11px] text-ink-faint hover:text-ink"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="font-semibold normal-case text-gold-bright hover:underline"
                  >
                    + Coluna
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleProspects.map((p) => {
              const atrasado = daysSince(p.lastTouchedAt) >= ATRASO_DAYS;
              const recusado = p.activation?.status === "RECUSADO";
              return (
                <tr key={p.id} className={recusado ? "bg-critical/[0.12]" : atrasado ? "bg-critical/[0.06]" : undefined}>
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
                        {recusado && (
                          <span className="rounded-full bg-critical/20 px-1.5 py-0.5 text-[10px] font-semibold text-critical">
                            Recusado
                          </span>
                        )}
                      </div>
                    </button>
                  </td>
                  {stages.map((s) => {
                    const value = p.stageValues.find((v) => v.stageId === s.id);
                    const unlocked = isStageUnlocked(p, s, stages);
                    if (!unlocked) {
                      return (
                        <td key={s.id} className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2.5 align-top">
                          <span className="text-[11px] text-ink-faint">🔒 Conclua a etapa anterior</span>
                        </td>
                      );
                    }
                    if (s.isClientStage) {
                      return (
                        <td key={s.id} className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2.5 align-top">
                          {!p.activation ? (
                            <button
                              onClick={() => setActivationTarget(p)}
                              className="rounded-md bg-gold-solid px-2.5 py-1.5 text-[11.5px] font-semibold text-black hover:bg-gold-solid-bright"
                            >
                              Tornar cliente ativo
                            </button>
                          ) : p.activation.status === "PENDENTE" ? (
                            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-faint">
                              Em análise pelo mediador
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
                  <td className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2.5" />
                </tr>
              );
            })}
            {visibleProspects.length === 0 && (
              <tr>
                <td colSpan={stages.length + 2} className="px-3 py-6 text-center text-xs text-ink-faint">
                  {prospects.length === 0
                    ? "Nenhuma prospecção ainda. Clique em “+ Nova prospecção” pra começar."
                    : "Nenhuma prospecção com essa etapa pendente."}
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

      {showSchedule && (
        <ScheduleTaskModal
          prospects={prospects}
          openDeals={openDeals}
          onClose={() => setShowSchedule(false)}
          onSaved={async () => {
            setShowSchedule(false);
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
          onCancelled={async () => {
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
          onCancelled={async () => {
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

/** Header cell for a custom (non-fixed) column: click the name to rename it
 * inline, same interaction as the Negócios Kanban's column headers. */
function CustomStageHeaderCell({ stage, onChanged }: { stage: ProspectStageDef; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [busy, setBusy] = useState(false);

  async function commitRename() {
    setEditing(false);
    if (name.trim() && name !== stage.name) {
      await renameProspectStageAction(stage.id, name);
      onChanged();
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir a coluna "${stage.name}"? O que estiver preenchido nela será perdido.`)) return;
    setBusy(true);
    await deleteProspectStageAction(stage.id);
    setBusy(false);
    onChanged();
  }

  return (
    <th className="border-b border-l border-dashed border-gold-deep/18 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
      <div className="flex items-center gap-1 normal-case">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === "Enter" && commitRename()}
            className="w-24 rounded-md border border-gold bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal text-ink outline-none"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="truncate text-left uppercase tracking-wide hover:text-ink">
            {stage.name}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={busy}
          aria-label={`Excluir coluna ${stage.name}`}
          className="text-ink-faint hover:text-critical disabled:opacity-60"
        >
          ×
        </button>
      </div>
    </th>
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

function ScheduleTaskModal({
  prospects,
  openDeals,
  onClose,
  onSaved,
}: {
  prospects: ProspectRow[];
  openDeals: OpenDeal[];
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
    const r = await scheduleTaskAction(fd);
    if (r.error) {
      setError(r.error);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell title="Agendar" onClose={onClose}>
      <p className="mb-2.5 text-[11px] text-ink-faint">
        Aparece na Agenda, e se não for concluída até o dia entra em &ldquo;Atrasados&rdquo; automaticamente.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {error && <p className="rounded-md bg-critical/10 px-2.5 py-1.5 text-xs text-critical">{error}</p>}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">O que fazer</span>
          <input name="title" required placeholder="Ex.: Ligar de volta pro cliente" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Data</span>
          <input name="dueDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Vincular a (opcional)</span>
          <select name="link" defaultValue="" className={inputClass}>
            <option value="">Nenhuma</option>
            {prospects.length > 0 && (
              <optgroup label="Prospecções">
                {prospects.map((p) => (
                  <option key={p.id} value={`prospect:${p.id}`}>
                    {p.clientName}
                  </option>
                ))}
              </optgroup>
            )}
            {openDeals.length > 0 && (
              <optgroup label="Negócios">
                {openDeals.map((d) => (
                  <option key={d.id} value={`deal:${d.id}`}>
                    {d.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
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
            {saving ? "Salvando…" : "Agendar"}
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
  onCancelled,
}: {
  prospect: ProspectRow;
  stage: ProspectStageDef;
  onClose: () => void;
  onSaved: () => void;
  onCancelled: () => void;
}) {
  const existing = prospect.stageValues.find((v) => v.stageId === stage.id);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(existing?.done ?? false);
  const [scheduleReturn, setScheduleReturn] = useState(false);
  const [returnDate, setReturnDate] = useState("");

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
    if (done && scheduleReturn && returnDate) {
      const taskFd = new FormData();
      taskFd.set("title", `Retorno — ${prospect.clientName} (${stage.name})`);
      taskFd.set("dueDate", returnDate);
      taskFd.set("link", `prospect:${prospect.id}`);
      const taskResult = await scheduleTaskAction(taskFd);
      if (taskResult.error) {
        setError(taskResult.error);
        setSaving(false);
        return;
      }
    }
    onSaved();
  }

  async function handleCancelProspect() {
    if (!confirm(`Cancelar a prospecção de "${prospect.clientName}"?`)) return;
    setCancelling(true);
    const r = await deleteProspectAction(prospect.id);
    if (r.error) {
      setError(r.error);
      setCancelling(false);
      return;
    }
    onCancelled();
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
          <input
            name="done"
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Concluído
        </label>
        {done && (
          <div className="rounded-md border border-gold-deep/25 bg-surface-2/50 p-2.5">
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={scheduleReturn}
                onChange={(e) => setScheduleReturn(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Agendar um retorno
            </label>
            {scheduleReturn && (
              <label className="mt-2 flex flex-col gap-1 text-xs">
                <span className="text-ink-faint">Data do retorno</span>
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className={inputClass}
                />
              </label>
            )}
          </div>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCancelProspect}
            disabled={cancelling}
            className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical disabled:opacity-60"
          >
            {cancelling ? "Cancelando…" : "Cancelar prospecção"}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink">
              Fechar
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

function ActivationModal({
  prospect,
  onClose,
  onSaved,
  onCancelled,
}: {
  prospect: ProspectRow;
  onClose: () => void;
  onSaved: () => void;
  onCancelled: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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

  async function handleCancelProspect() {
    if (!confirm(`Cancelar a prospecção de "${prospect.clientName}"?`)) return;
    setCancelling(true);
    const r = await deleteProspectAction(prospect.id);
    if (r.error) {
      setError(r.error);
      setCancelling(false);
      return;
    }
    onCancelled();
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
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCancelProspect}
            disabled={cancelling}
            className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical disabled:opacity-60"
          >
            {cancelling ? "Cancelando…" : "Cancelar prospecção"}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink">
              Fechar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright disabled:opacity-60"
            >
              {saving ? "Enviando…" : "Enviar para aprovação"}
            </button>
          </div>
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
