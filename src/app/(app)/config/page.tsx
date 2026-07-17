import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireView } from "@/lib/require-permission";
import { canView, getPermissionMatrix, type Module } from "@/lib/permissions";
import { listActivity } from "@/lib/activity-log";
import { AppearanceSettings } from "@/components/shell/AppearanceSettings";
import type { Role } from "@/generated/prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  SELLER: "Vendedor",
  SUPPORT: "Suporte",
  MANAGER: "Gerente",
  ADMIN: "Admin",
  MEDIATOR: "Mediador",
};
const ROLE_ORDER: Role[] = ["MEDIATOR", "ADMIN", "MANAGER", "SELLER", "SUPPORT"];

const MODULE_LABELS: Record<Module, string> = {
  analitica: "Início",
  vendas: "Clientes",
  negocios: "Negócios",
  prospeccoes: "Prospecções",
  agenda: "Agenda",
  social: "Comunicados",
  ia: "IA",
  perfil: "Perfil",
  config: "Config",
  activityLogs: "Logs",
};
const MODULE_ORDER: Module[] = [
  "analitica", "vendas", "negocios", "prospeccoes", "agenda", "social", "ia", "perfil", "config", "activityLogs",
];

const ACTION_LABEL: Record<string, string> = {
  created: "criou",
  updated: "atualizou",
  deleted: "excluiu",
  restored: "restaurou",
  stage_changed: "mudou o estágio de",
  call_logged: "registrou uma ligação em",
  unlocked: "desbloqueou o acesso de",
};
const ENTITY_LABEL: Record<string, string> = {
  Contact: "um cliente",
  Deal: "um negócio",
  PipelineStage: "uma coluna",
  User: "um usuário",
};

function diffSummary(diff: unknown): string | null {
  if (diff && typeof diff === "object" && !Array.isArray(diff)) {
    const d = diff as Record<string, unknown>;
    if (typeof d.note === "string") return d.note;
    if (typeof d.outcome === "string") return d.outcome;
  }
  return null;
}

export default async function ConfigPage() {
  const session = await requireView("config");
  const [activity, matrix] = await Promise.all([
    canView(session.user.role, "activityLogs") ? listActivity(session) : Promise.resolve([]),
    Promise.resolve(getPermissionMatrix()),
  ]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Config</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Permissões por módulo e registro de atividades
        </p>
      </div>

      <AppearanceSettings />

      <div className="mb-4 rounded-xl border border-gold-deep/30 bg-surface p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-ink">Permissões por perfil</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[11.5px]">
            <thead>
              <tr>
                <th className="border-b border-gold-deep/30 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                  Perfil
                </th>
                {MODULE_ORDER.map((mod) => (
                  <th
                    key={mod}
                    className="border-b border-gold-deep/30 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {MODULE_LABELS[mod]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_ORDER.map((role) => (
                <tr key={role}>
                  <td className="border-b border-dashed border-gold-deep/18 px-2.5 py-2 font-semibold text-ink">
                    {ROLE_LABELS[role]}
                  </td>
                  {MODULE_ORDER.map((mod) => {
                    const perm = matrix[mod][role];
                    return (
                      <td
                        key={mod}
                        className={`border-b border-dashed border-gold-deep/18 px-2.5 py-2 tabular-nums ${
                          perm.level === "none" ? "text-ink-faint" : "text-ink-muted"
                        }`}
                      >
                        {perm.level === "none" ? "—" : `${perm.level === "edit" ? "editar" : "ver"} · ${perm.scope}`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          O Mediador sempre tem acesso total a tudo. Os demais perfis só acessam o que está
          listado aqui — &ldquo;ver&rdquo; é somente leitura, &ldquo;editar&rdquo; permite criar e alterar.
        </p>
      </div>

      {canView(session.user.role, "activityLogs") && (
        <div className="rounded-xl border border-gold-deep/30 bg-surface p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-ink">Registro de atividades</h3>
          {activity.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhuma atividade registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activity.map((log) => {
                const summary = diffSummary(log.diff);
                const target =
                  log.contact?.accountName ||
                  (log.contact ? `${log.contact.firstName} ${log.contact.lastName}` : null) ||
                  log.deal?.name ||
                  ENTITY_LABEL[log.entityType] ||
                  log.entityType;
                return (
                  <li key={log.id} className="border-b border-dashed border-gold-deep/15 pb-2 text-[12px] text-ink-muted last:border-b-0">
                    <b className="text-ink">{log.actor.name}</b>{" "}
                    {ACTION_LABEL[log.action] ?? log.action.replace(/_/g, " ")}{" "}
                    <span className="text-ink">{target}</span>
                    <span className="ml-1.5 text-ink-faint">
                      · {formatDistanceToNow(log.createdAt, { addSuffix: true, locale: ptBR })}
                    </span>
                    {summary && <div className="mt-0.5 text-ink-faint">&ldquo;{summary}&rdquo;</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
