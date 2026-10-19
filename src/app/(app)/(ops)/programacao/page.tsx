import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { scheduleScopeWhere, upcomingOccurrences, SCHEDULE_ACTIONS } from "@/lib/erp/schedules";
import { fmtDate } from "@/lib/erp/format";
import { Badge, Card, EmptyState, NoCompany, PageHeader, Table, thCls, tdCls, btnPrimary, btnSecondary } from "@/components/erp/ui";
import { ActionButton } from "@/components/erp/ActionForm";
import { processSchedulesAction } from "./actions";

const WINDOW_DAYS = 60;

export default async function ProgramacaoPage() {
  const session = await requireView("programacao");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const editable = canEdit(session.user.role, "programacao");
  const schedules = await prisma.customerSchedule.findMany({
    where: scheduleScopeWhere(session, ctx.active.id),
    orderBy: [{ active: "desc" }, { nextDate: "asc" }],
    include: {
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      responsible: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  const today = new Date();
  const dueCount = schedules.filter((s) => s.active && s.nextDate <= today).length;

  // Calendário: próximas ocorrências agrupadas por dia.
  const byDay = new Map<string, { date: Date; entries: { id: string; title: string; client: string }[] }>();
  for (const s of schedules.filter((x) => x.active)) {
    const client = s.contact.accountName || `${s.contact.firstName} ${s.contact.lastName}`;
    for (const d of upcomingOccurrences(s.nextDate, s.frequencyDays, WINDOW_DAYS)) {
      const key = d.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { date: d, entries: [] });
      byDay.get(key)!.entries.push({ id: s.id, title: s.title, client });
    }
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Programação de clientes"
        subtitle="Pedidos recorrentes: geram tarefa ou cotação na data, sem baixar estoque."
        actions={
          editable && (
            <>
              <ActionButton action={processSchedulesAction} className={btnSecondary}>
                Processar vencidas{dueCount ? ` (${dueCount})` : ""}
              </ActionButton>
              <Link href="/programacao/nova" className={btnPrimary}>Nova programação</Link>
            </>
          )
        }
      />

      {schedules.length === 0 ? (
        <EmptyState>Nenhuma programação cadastrada.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Programação</th>
              <th className={thCls}>Cliente</th>
              <th className={thCls}>Responsável</th>
              <th className={thCls}>A cada</th>
              <th className={thCls}>Próxima</th>
              <th className={thCls}>Ao vencer</th>
              <th className={thCls}>Status</th>
            </>
          }
        >
          {schedules.map((s) => (
            <tr key={s.id} className="hover:bg-surface-2">
              <td className={tdCls}>
                <Link href={`/programacao/${s.id}`} className="font-semibold text-gold hover:underline">{s.title}</Link>
                <span className="block text-[11px] text-ink-faint">{s._count.items} produto(s)</span>
              </td>
              <td className={tdCls}>{s.contact.accountName || `${s.contact.firstName} ${s.contact.lastName}`}</td>
              <td className={tdCls}>{s.responsible.name}</td>
              <td className={`${tdCls} tabular-nums`}>{s.frequencyDays} dias</td>
              <td className={`${tdCls} tabular-nums`}>
                {fmtDate(s.nextDate)}
                {s.active && s.nextDate <= today && <span className="ml-1"><Badge tone="warning">vencida</Badge></span>}
              </td>
              <td className={tdCls}>{SCHEDULE_ACTIONS[s.action] ?? s.action}</td>
              <td className={tdCls}>{s.active ? <Badge tone="good">Ativa</Badge> : <Badge>Inativa</Badge>}</td>
            </tr>
          ))}
        </Table>
      )}

      <Card title={`Próximos ${WINDOW_DAYS} dias`}>
        {days.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma ocorrência prevista.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {days.map(([key, d]) => (
              <div key={key} className="rounded-lg border border-gold-deep/25 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                  {d.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}
                </p>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {d.entries.map((e, i) => (
                    <li key={`${e.id}-${i}`}>
                      <Link href={`/programacao/${e.id}`} className="hover:underline">{e.title}</Link>
                      <span className="block text-[11px] text-ink-faint">{e.client}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
