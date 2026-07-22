"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Prisma } from "@/generated/prisma/client";
import type { ContactInsights } from "@/lib/contacts";
import { deleteContactAction } from "@/app/(app)/vendas/actions";
import { addPastSaleAction } from "@/app/(app)/negocios/actions";
import { WhatsAppSendBox } from "@/components/vendas/WhatsAppSendBox";
import { DealDetailModal } from "@/components/negocios/DealDetailModal";

/** deals.value is typed as `number`, not Prisma's Decimal — Client
 * Components can't receive Decimal instances from a Server Component
 * (Next.js only allows plain serializable objects across that boundary),
 * so the page converts it with Number() before handing the contact down. */
type ContactWithRelations = Prisma.ContactGetPayload<{
  include: {
    owner: { select: { name: true; email: true } };
    activityLogs: { include: { actor: { select: { name: true } } } };
  };
}> & {
  deals: Array<{
    id: string;
    name: string;
    value: number;
    updatedAt: Date;
    stage: { name: string; isWon: boolean; isOnTheWay: boolean };
  }>;
};

const PERSON_TYPE_LABEL: Record<string, string> = { FISICA: "Física", JURIDICA: "Jurídica" };
const POTENTIAL_LABEL: Record<string, string> = { ALTO: "Alto", MEDIO: "Médio", BAIXO: "Baixo" };
const CRM_STATUS_LABEL: Record<string, string> = { LEAD: "Lead", ATIVO: "Ativo", INATIVO: "Inativo" };
const PRIORITY_STYLE: Record<ContactInsights["prioridade"], string> = {
  alta: "border-critical/50 text-critical",
  média: "border-gold-deep text-gold",
  baixa: "border-ink-faint/40 text-ink-muted",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("pt-BR") : "—";
}

const ACTION_LABEL: Record<string, string> = {
  created: "criou este contato",
  updated: "atualizou este contato",
  deleted: "removeu este contato",
  restored: "restaurou este contato",
  stage_changed: "mudou o estágio de um negócio",
  call_logged: "registrou uma ligação",
};

function callOutcome(diff: Prisma.JsonValue | null): string | null {
  if (diff && typeof diff === "object" && !Array.isArray(diff) && "outcome" in diff) {
    const outcome = (diff as { outcome?: unknown }).outcome;
    return typeof outcome === "string" ? outcome : null;
  }
  return null;
}

function fieldRow(label: string, value: string | null | undefined) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-gold-deep/20 py-1.5 text-[12.5px]">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right text-ink">{value || "—"}</span>
    </div>
  );
}

const TABS = [
  { key: "geral", label: "Visão geral" },
  { key: "historico", label: "Histórico" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function PastSaleForm({ contactId, ownerId }: { contactId: string; ownerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startSave(async () => {
      const res = await addPastSaleAction(contactId, formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
      >
        ＋ Registrar venda antiga
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-gold-deep/40 bg-surface-2 p-3"
    >
      <input type="hidden" name="ownerId" value={ownerId} />
      <p className="text-[11px] text-ink-faint">
        Para clientes que já compravam antes de entrar no CRM — a venda aparece no histórico e nos
        relatórios do mês em que ela realmente aconteceu.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">O que foi vendido</span>
          <input
            name="name"
            required
            className="rounded-md border border-gold-deep/40 bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Valor (R$)</span>
          <input
            name="value"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="rounded-md border border-gold-deep/40 bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Data da venda</span>
        <input
          name="soldAt"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          className="w-40 rounded-md border border-gold-deep/40 bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
        />
      </label>
      {error && <p className="text-[11.5px] text-critical">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-ink-faint hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-gold-solid px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Salvando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}

export function ContactDetailPanel({
  contact,
  canEdit,
  canEditDeals,
  insights,
}: {
  contact: ContactWithRelations;
  canEdit: boolean;
  canEditDeals: boolean;
  insights: ContactInsights;
}) {
  const [tab, setTab] = useState<TabKey>("geral");
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const initials = `${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`.toUpperCase();
  const waNumber = contact.mobile?.replace(/\D/g, "");

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface p-5">
      <div className="mb-4 flex items-center gap-3.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-deep bg-surface-3 font-display text-lg text-gold-bright">
          {initials}
        </div>
        <div>
          <h3 className="font-display text-lg text-ink">
            {contact.firstName} {contact.lastName}
          </h3>
          <p className="text-xs text-ink-muted">
            {contact.jobTitle ?? "—"} · {contact.accountName ?? "—"}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              title="Enviar e-mail"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-3 text-ink-muted transition-colors hover:text-gold-bright"
            >
              ✉
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/55${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir WhatsApp"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-3 text-ink-muted transition-colors hover:text-gold-bright"
            >
              📱
            </a>
          )}
        </div>
      </div>

      <WhatsAppSendBox phone={contact.mobile ?? contact.phone} />

      <div className="mb-4 mt-4 flex gap-1.5 rounded-lg bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              tab === t.key ? "bg-gold-solid text-black" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "geral" && (
        <>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Identificação</h4>
              {fieldRow("Proprietário", contact.owner.name)}
              {fieldRow("Tipo de pessoa", contact.personType ? PERSON_TYPE_LABEL[contact.personType] : null)}
              {fieldRow("CNPJ", contact.cnpj)}
              {fieldRow("Departamento", contact.department)}
              {fieldRow("Data de aniversário", formatDate(contact.birthday))}
            </div>
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Contato</h4>
              {fieldRow("E-mail", contact.email)}
              {fieldRow("Celular / Telefone", [contact.mobile, contact.phone].filter(Boolean).join(" · "))}
              {fieldRow("Residencial / Assistente", [contact.residentialPhone, contact.assistantPhone].filter(Boolean).join(" · "))}
            </div>
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Origem e relacionamento</h4>
              {fieldRow("Fonte de cliente potencial", contact.leadSource)}
              {fieldRow("Nome fornecedor", contact.supplierName)}
              {fieldRow("Potencial comercial", contact.commercialPotential ? POTENTIAL_LABEL[contact.commercialPotential] : null)}
              {fieldRow("Status CRM", contact.crmStatus ? CRM_STATUS_LABEL[contact.crmStatus] : null)}
              {fieldRow("Próximo contato", formatDate(contact.nextContactAt))}
            </div>
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Endereço</h4>
              {fieldRow("Rua / Número", [contact.street, contact.number].filter(Boolean).join(", "))}
              {fieldRow("Cidade / Estado / CEP", [contact.city, contact.state, contact.postalCode].filter(Boolean).join(" · "))}
              {fieldRow(
                "Coordenadas",
                contact.latitude && contact.longitude ? `${contact.latitude}, ${contact.longitude}` : null,
              )}
            </div>
          </div>

          {contact.notes && (
            <div className="mt-4 rounded-lg border border-dashed border-gold-deep/30 bg-surface-2 p-3 text-[12.5px] text-ink-muted">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gold">Observações</span>
              {contact.notes}
            </div>
          )}

          <div className="mt-5 border-t border-gold-deep/20 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gold">Inteligência do cliente</h4>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[insights.prioridade]}`}>
                Prioridade {insights.prioridade}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-3">
              {fieldRow("Valor comprado", formatCurrency(insights.valorComprado))}
              {fieldRow("Qtd. negócios ganhos", String(insights.quantidadeComprada))}
              {fieldRow("Ticket médio", formatCurrency(insights.ticketMedio))}
              {fieldRow("Classe ABC", insights.abcClass)}
              {fieldRow("Etapa do funil", insights.etapaFunil)}
              {fieldRow("Dias sem contato", insights.diasSemContato !== null ? String(insights.diasSemContato) : null)}
              {fieldRow(
                "Dias até aniversário",
                insights.diasAteAniversario !== null ? String(insights.diasAteAniversario) : null,
              )}
            </div>
            <p className="mt-2 text-[12.5px] text-ink">
              <span className="text-ink-faint">Ação recomendada: </span>
              {insights.acaoRecomendada}
            </p>
          </div>

          {contact.activityLogs.length > 0 && (
            <div className="mt-5 border-t border-gold-deep/20 pt-4">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">Atividade</h4>
              <ul className="flex flex-col gap-2">
                {contact.activityLogs.map((log) => {
                  const outcome = callOutcome(log.diff);
                  return (
                    <li key={log.id} className="flex items-start gap-2.5 text-xs text-ink-muted">
                      <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-info" />
                      <span>
                        <b className="text-ink">{log.actor.name}</b> {ACTION_LABEL[log.action] ?? log.action}
                        <span className="ml-1.5 text-ink-faint">
                          · {formatDistanceToNow(log.createdAt, { addSuffix: true, locale: ptBR })}
                        </span>
                        {outcome && <span className="mt-0.5 block text-ink-muted">&ldquo;{outcome}&rdquo;</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {canEdit && (
            <div className="mt-5 flex gap-2 border-t border-gold-deep/20 pt-4">
              <Link
                href={`/vendas?id=${contact.id}&edit=1`}
                className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
              >
                Editar
              </Link>
              <form action={deleteContactAction.bind(null, contact.id)}>
                <button
                  type="submit"
                  className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical transition-colors hover:border-critical"
                >
                  Excluir
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {tab === "historico" && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-ink-faint">Clique em um item pra ver os detalhes e editar.</p>
          <ul className="flex flex-col gap-2.5">
            {contact.deals
              .slice()
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
              .map((deal) => (
                <li key={deal.id}>
                  <button
                    type="button"
                    onClick={() => setOpenDealId(deal.id)}
                    className="flex w-full items-start gap-2.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-surface-2"
                  >
                    <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-gold" />
                    <span>
                      <b className="text-ink">{deal.name}</b> — {formatCurrency(deal.value)} · estágio{" "}
                      {deal.stage.name}
                      <span className="ml-1.5 text-ink-faint">· {formatDate(deal.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            {contact.deals.length === 0 && (
              <li className="text-xs text-ink-faint">Nenhuma negociação registrada ainda.</li>
            )}
          </ul>

          {canEditDeals && (
            <div className="mt-2 border-t border-gold-deep/20 pt-3">
              <PastSaleForm contactId={contact.id} ownerId={contact.ownerId} />
            </div>
          )}
        </div>
      )}

      {openDealId && (
        <DealDetailModal dealId={openDealId} canEdit={canEditDeals} onClose={() => setOpenDealId(null)} />
      )}
    </div>
  );
}
