import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canEdit, canView } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { scheduleScopeWhere, SCHEDULE_ACTIONS } from "@/lib/erp/schedules";
import { loadScheduleFormOptions } from "@/lib/erp/schedule-queries";
import { fmtDate, fmtDateTime, orderCode, toDateInput } from "@/lib/erp/format";
import { Card, NoCompany, PageHeader, btnPrimary } from "@/components/erp/ui";
import { ActionButton } from "@/components/erp/ActionForm";
import { BackLink } from "@/components/shell/BackLink";
import { ScheduleForm } from "@/components/erp/programacao/ScheduleForm";
import { processSchedulesAction, saveScheduleAction } from "../actions";

export default async function ProgramacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("programacao");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const { id } = await params;
  const schedule = await prisma.customerSchedule.findFirst({
    where: { id, ...scheduleScopeWhere(session, ctx.active.id) },
    include: {
      contact: { select: { firstName: true, lastName: true, accountName: true } },
      responsible: { select: { name: true } },
      items: { include: { product: { select: { sku: true, name: true } } } },
      runs: { orderBy: { scheduledFor: "desc" }, take: 30 },
    },
  });
  if (!schedule) notFound();
  const editable = canEdit(session.user.role, "programacao");
  const orders = await prisma.salesOrder.findMany({
    where: { companyId: ctx.active.id, id: { in: schedule.runs.map((r) => r.orderId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, number: true },
  });
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const client = schedule.contact.accountName || `${schedule.contact.firstName} ${schedule.contact.lastName}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <BackLink href="/programacao" label="Programação" />
        <PageHeader
          title={schedule.title}
          subtitle={`${client} · a cada ${schedule.frequencyDays} dias · próxima ${fmtDate(schedule.nextDate)} · ${SCHEDULE_ACTIONS[schedule.action] ?? schedule.action}`}
          actions={
            editable &&
            schedule.active && (
              <ActionButton
                action={processSchedulesAction}
                fields={{ scheduleId: schedule.id }}
                className={btnPrimary}
                confirm="Gerar agora a próxima ocorrência e avançar a data?"
              >
                Gerar agora
              </ActionButton>
            )
          }
        />
      </div>

      {editable ? (
        <ScheduleForm
          action={saveScheduleAction}
          {...await loadScheduleFormOptions(session, ctx.active.id)}
          initial={{
            scheduleId: schedule.id,
            contactId: schedule.contactId,
            responsibleId: schedule.responsibleId,
            title: schedule.title,
            frequencyDays: schedule.frequencyDays,
            nextDate: toDateInput(schedule.nextDate),
            action: schedule.action,
            conditions: schedule.conditions ?? "",
            notes: schedule.notes ?? "",
            active: schedule.active,
            items: schedule.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          }}
        />
      ) : (
        <Card title="Produtos">
          <ul className="text-sm">
            {schedule.items.map((i) => (
              <li key={i.id}>{i.quantity} × {i.product.sku} · {i.product.name}</li>
            ))}
          </ul>
          {schedule.conditions && <p className="mt-2 text-xs text-ink-muted">Condições: {schedule.conditions}</p>}
          <p className="mt-1 text-xs text-ink-muted">Responsável: {schedule.responsible.name}</p>
        </Card>
      )}

      <Card title="Histórico de execuções">
        {schedule.runs.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma ocorrência processada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {schedule.runs.map((r) => {
              const order = r.orderId ? orderById.get(r.orderId) : undefined;
              return (
                <li key={r.id}>
                  <span className="tabular-nums">{fmtDate(r.scheduledFor)}</span>
                  {" · "}
                  {order ? (
                    canView(session.user.role, "pedidos") ? (
                      <Link href={`/pedidos/${order.id}`} className="text-gold hover:underline">
                        Cotação {orderCode(ctx.active.code, order.number)}
                      </Link>
                    ) : (
                      <>Cotação {orderCode(ctx.active.code, order.number)}</>
                    )
                  ) : r.taskId ? (
                    "Tarefa criada na Agenda"
                  ) : (
                    "Sem itens ativos"
                  )}
                  <span className="text-[11px] text-ink-faint"> · processado {fmtDateTime(r.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
