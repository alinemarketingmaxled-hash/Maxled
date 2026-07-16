"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import type { SerializedDeal } from "@/lib/serialize-deal";
import {
  moveDealAction,
  createStageAction,
  renameStageAction,
  deleteStageAction,
} from "@/app/(app)/negocios/actions";
import { DealDetailModal } from "@/components/negocios/DealDetailModal";

type StageWithDeals = {
  id: string;
  name: string;
  order: number;
  isOnTheWay: boolean;
  deals: SerializedDeal[];
};

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DealCard({
  deal,
  canEdit,
  onOpen,
}: {
  deal: SerializedDeal;
  canEdit: boolean;
  onOpen: (dealId: string) => void;
}) {
  const initials = (deal.owner.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const daysLeft = deal.onTheWayDeadline
    ? differenceInCalendarDays(new Date(deal.onTheWayDeadline), new Date())
    : null;
  const hasFlaggedNote = deal.notes.some((n) => n.flagged);

  return (
    <Link
      href={`/negocios/${deal.id}`}
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", deal.id);
      }}
      onClick={(e) => {
        // Plain click opens the quick-view modal; ctrl/cmd/middle-click keeps
        // the normal browser behavior of opening the full page in a new tab.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpen(deal.id);
      }}
      className="flex flex-col gap-1.5 rounded-lg border border-gold-deep/25 bg-surface-2 p-2.5 text-left transition-colors hover:border-gold-deep/60"
    >
      <div>
        <div className="text-[12.5px] font-semibold text-ink">{deal.name}</div>
        <div className="text-[10.5px] text-ink-faint">
          {deal.contact.accountName ?? `${deal.contact.firstName} ${deal.contact.lastName}`}
        </div>
      </div>
      <div className="text-[13px] font-bold text-gold-bright">{currency(deal.value)}</div>
      <div className="flex items-center gap-2 text-[10.5px] text-ink-faint">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-[8.5px] font-bold text-gold-bright">
          {initials}
        </span>
        {deal.owner.name}
        {hasFlaggedNote && (
          <span className="ml-auto text-gold-bright" title="Tem mensagem marcada">
            ★
          </span>
        )}
        {deal.notes.length > 0 && (
          <span className={hasFlaggedNote ? "" : "ml-auto"}>📎 {deal.notes.length}</span>
        )}
        {daysLeft !== null && (
          <span
            className={`ml-auto rounded-full px-1.5 py-0.5 font-semibold ${
              daysLeft <= 0 ? "bg-critical/15 text-critical" : "bg-warning/15 text-warning"
            }`}
          >
            {daysLeft <= 0 ? "vence hoje" : `${daysLeft} dia${daysLeft > 1 ? "s" : ""}`}
          </span>
        )}
      </div>
      {(deal.contact.phone || deal.contact.mobile || deal.contact.email) && (
        <div className="flex items-center gap-1.5 border-t border-gold-deep/15 pt-1.5">
          {(deal.contact.phone || deal.contact.mobile) && (
            <button
              type="button"
              title={`Ligar para ${deal.contact.phone ?? deal.contact.mobile}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `tel:${deal.contact.phone ?? deal.contact.mobile}`;
              }}
              className="flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted hover:text-gold-bright"
            >
              📞 Ligar
            </button>
          )}
          {deal.contact.email && (
            <button
              type="button"
              title={`Enviar e-mail para ${deal.contact.email}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `mailto:${deal.contact.email}`;
              }}
              className="flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted hover:text-gold-bright"
            >
              ✉️ E-mail
            </button>
          )}
        </div>
      )}
    </Link>
  );
}

function StageColumn({
  stage,
  canEdit,
  isLastStage,
  onOpenDeal,
}: {
  stage: StageWithDeals;
  canEdit: boolean;
  isLastStage: boolean;
  onOpenDeal: (dealId: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [isDragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dealId = e.dataTransfer.getData("text/plain");
    if (!dealId) return;
    startTransition(async () => {
      await moveDealAction(dealId, stage.id);
      router.refresh();
    });
  }

  async function commitRename() {
    setEditing(false);
    if (name.trim() && name !== stage.name) {
      await renameStageAction(stage.id, name);
      router.refresh();
    }
  }

  async function handleDeleteStage() {
    if (!confirm(`Excluir a coluna "${stage.name}"? Os negócios nela serão movidos para a primeira coluna.`)) {
      return;
    }
    await deleteStageAction(stage.id);
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={canEdit ? handleDrop : undefined}
      className={`flex w-60 flex-none flex-col gap-2 rounded-xl border p-2.5 transition-colors ${
        isDragOver ? "border-gold bg-surface-2" : "border-gold-deep/28 bg-surface"
      }`}
    >
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-muted">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === "Enter" && commitRename()}
            className="w-full rounded-md border border-gold bg-surface-2 px-1.5 py-0.5 text-ink outline-none"
          />
        ) : (
          <span
            onClick={() => canEdit && setEditing(true)}
            className={canEdit ? "cursor-text" : undefined}
          >
            {stage.name}
          </span>
        )}
        <span className="ml-auto rounded-full bg-surface-2 px-1.5 text-[10.5px] text-ink-faint">
          {stage.deals.length}
        </span>
        {canEdit && !isLastStage && (
          <button
            onClick={handleDeleteStage}
            title="Excluir coluna"
            className="text-ink-faint hover:text-critical"
          >
            ×
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {stage.deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} canEdit={canEdit} onOpen={onOpenDeal} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  stages,
  pipelineId,
  canEdit,
}: {
  stages: StageWithDeals[];
  pipelineId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [openDealId, setOpenDealId] = useState<string | null>(null);

  async function handleAddColumn() {
    if (!newColumnName.trim()) return;
    const fd = new FormData();
    fd.set("name", newColumnName);
    await createStageAction(pipelineId, fd);
    setNewColumnName("");
    setAddingColumn(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 pb-2">
        {stages.map((stage, i) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            canEdit={canEdit}
            isLastStage={stages.length === 1 && i === 0}
            onOpenDeal={setOpenDealId}
          />
        ))}
        {canEdit && (
          <div className="flex w-56 flex-none flex-col gap-2 rounded-xl border border-dashed border-gold-deep/40 p-3">
            {addingColumn ? (
              <>
                <input
                  autoFocus
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                  placeholder="Nome da coluna"
                  className="rounded-md border border-gold-deep/40 bg-surface-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
                />
                <button
                  onClick={handleAddColumn}
                  className="rounded-md bg-gold-solid px-2 py-1.5 text-xs font-semibold text-black hover:bg-gold-solid-bright"
                >
                  Adicionar
                </button>
              </>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="text-xs font-semibold text-ink-faint hover:text-gold-bright"
              >
                ＋ Adicionar coluna
              </button>
            )}
          </div>
        )}
      </div>

      {openDealId && (
        <DealDetailModal dealId={openDealId} canEdit={canEdit} onClose={() => setOpenDealId(null)} />
      )}
    </>
  );
}
