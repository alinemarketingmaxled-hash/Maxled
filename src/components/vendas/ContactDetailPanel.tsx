import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Prisma } from "@/generated/prisma/client";
import { deleteContactAction } from "@/app/(app)/vendas/actions";
import { WhatsAppSendBox } from "@/components/vendas/WhatsAppSendBox";

type ContactWithRelations = Prisma.ContactGetPayload<{
  include: {
    owner: { select: { name: true; email: true } };
    deals: { include: { stage: { select: { name: true } } } };
    activityLogs: { include: { actor: { select: { name: true } } } };
  };
}>;

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

export function ContactDetailPanel({
  contact,
  canEdit,
}: {
  contact: ContactWithRelations;
  canEdit: boolean;
}) {
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

      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Identificação</h4>
          {fieldRow("Proprietário", contact.owner.name)}
          {fieldRow("Departamento", contact.department)}
        </div>
        <div>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Contato</h4>
          {fieldRow("E-mail", contact.email)}
          {fieldRow("Celular / Telefone", [contact.mobile, contact.phone].filter(Boolean).join(" · "))}
          {fieldRow("Residencial / Assistente", [contact.residentialPhone, contact.assistantPhone].filter(Boolean).join(" · "))}
        </div>
        <div>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Origem</h4>
          {fieldRow("Fonte de cliente potencial", contact.leadSource)}
          {fieldRow("Nome fornecedor", contact.supplierName)}
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

      <div className="mt-5 border-t border-gold-deep/20 pt-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Histórico do cliente
        </h4>
        <ul className="flex flex-col gap-2.5">
          {contact.deals.map((deal) => (
            <li key={deal.id} className="flex items-start gap-2.5 text-xs">
              <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-gold" />
              <span>
                Negócio <b className="text-ink">{deal.name}</b> — R${" "}
                {Number(deal.value).toLocaleString("pt-BR")} · estágio {deal.stage.name}
              </span>
            </li>
          ))}
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
          {contact.deals.length === 0 && contact.activityLogs.length === 0 && (
            <li className="text-xs text-ink-faint">Sem histórico ainda.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
