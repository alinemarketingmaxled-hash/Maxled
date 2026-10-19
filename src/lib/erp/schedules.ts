import "server-only";
import type { Session } from "next-auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit, getPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { addOrderEvent, nextOrderNumber } from "@/lib/erp/orders";
import { addDays, D, lineSubtotal } from "@/lib/erp/money";

type Tx = Prisma.TransactionClient;

export class ScheduleError extends Error {}

export const SCHEDULE_ACTIONS: Record<string, string> = {
  COTACAO: "Gerar cotação",
  TAREFA: "Criar tarefa",
};

/** Programações visíveis: empresa ativa; no escopo "own" só as que o
 * usuário é responsável ou cujo cliente está na carteira dele. */
export function scheduleScopeWhere(session: Session, companyId: string): Prisma.CustomerScheduleWhereInput {
  const { scope } = getPermission(session.user.role, "programacao");
  if (scope === "own") {
    return { companyId, OR: [{ responsibleId: session.user.id }, { contact: { ownerId: session.user.id } }] };
  }
  return { companyId };
}

export type ScheduleInput = {
  contactId: string;
  responsibleId: string;
  title: string;
  frequencyDays: number;
  nextDate: Date;
  action: string;
  conditions: string | null;
  notes: string | null;
  active: boolean;
  items: { productId: string; quantity: number }[];
};

export async function saveSchedule(session: Session, companyId: string, input: ScheduleInput, id?: string) {
  if (!canEdit(session.user.role, "programacao")) throw new ScheduleError("Sem permissão.");
  if (!input.title.trim()) throw new ScheduleError("Informe um título.");
  if (!Number.isInteger(input.frequencyDays) || input.frequencyDays < 1 || input.frequencyDays > 3650) {
    throw new ScheduleError("Periodicidade deve ser de 1 a 3650 dias.");
  }
  if (!SCHEDULE_ACTIONS[input.action]) throw new ScheduleError("Ação inválida.");
  const own = getPermission(session.user.role, "programacao").scope === "own";

  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, deletedAt: null, ...(own ? { ownerId: session.user.id } : {}) },
    select: { id: true },
  });
  if (!contact) throw new ScheduleError("Cliente não encontrado na sua carteira.");
  const responsibleId = own ? session.user.id : input.responsibleId || session.user.id;

  const items = input.items.filter((i) => i.productId && i.quantity > 0);
  if (items.some((i) => !Number.isInteger(i.quantity))) throw new ScheduleError("Quantidades devem ser inteiras.");
  if (items.length > 0) {
    const valid = await prisma.product.count({ where: { companyId, id: { in: items.map((i) => i.productId) }, deletedAt: null } });
    if (valid !== new Set(items.map((i) => i.productId)).size) throw new ScheduleError("Produto inválido para esta empresa.");
  }
  if (input.action === "COTACAO" && items.length === 0) throw new ScheduleError("Para gerar cotação, inclua os produtos.");

  const data = {
    contactId: contact.id,
    responsibleId,
    title: input.title.trim(),
    frequencyDays: input.frequencyDays,
    nextDate: input.nextDate,
    action: input.action,
    conditions: input.conditions,
    notes: input.notes,
    active: input.active,
  };
  const schedule = await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.customerSchedule.findFirst({ where: { id, ...scheduleScopeWhere(session, companyId) }, select: { id: true } });
      if (!existing) throw new ScheduleError("Programação não encontrada.");
      await tx.customerScheduleItem.deleteMany({ where: { scheduleId: id } });
      return tx.customerSchedule.update({ where: { id }, data: { ...data, items: { create: items } } });
    }
    return tx.customerSchedule.create({ data: { ...data, companyId, items: { create: items } } });
  });
  await logActivity({
    actorId: session.user.id, entityType: "CustomerSchedule", entityId: schedule.id, action: id ? "updated" : "created", companyId,
  });
  return schedule;
}

/** Cotação gerada pela programação: preços de tabela atuais, status
 * COTACAO. Nunca reserva nem baixa estoque (§4.8) — o vendedor revisa e
 * envia como qualquer cotação. */
async function createScheduledQuote(
  tx: Tx,
  schedule: { id: string; companyId: string; contactId: string; responsibleId: string; title: string; conditions: string | null },
  items: { productId: string; quantity: number }[],
  scheduledFor: Date,
) {
  const products = await tx.product.findMany({
    where: { companyId: schedule.companyId, id: { in: items.map((i) => i.productId) }, deletedAt: null, active: true },
    select: { id: true, price: true, cost: true, minPrice: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = items
    .filter((i) => byId.has(i.productId))
    .map((i, position) => {
      const p = byId.get(i.productId)!;
      const subtotal = lineSubtotal(i.quantity, p.price, 0);
      return {
        productId: p.id, quantity: i.quantity, unitPrice: p.price, discountPct: D(0), subtotal,
        unitCost: p.cost, belowMinPrice: p.minPrice !== null && p.price.lessThan(p.minPrice), position,
      };
    });
  if (rows.length === 0) return null;
  const itemsTotal = rows.reduce((s, r) => s.add(r.subtotal), D(0));
  const contact = await tx.contact.findUniqueOrThrow({
    where: { id: schedule.contactId },
    select: { street: true, number: true, city: true, state: true, postalCode: true, enderecoEntrega: true },
  });
  const address = [contact.street && `${contact.street}${contact.number ? `, ${contact.number}` : ""}`, contact.city && `${contact.city}${contact.state ? `/${contact.state}` : ""}`, contact.postalCode]
    .filter(Boolean)
    .join(" - ");
  const number = await nextOrderNumber(tx, schedule.companyId);
  const order = await tx.salesOrder.create({
    data: {
      companyId: schedule.companyId,
      number,
      contactId: schedule.contactId,
      sellerId: schedule.responsibleId,
      itemsTotal,
      total: itemsTotal,
      billingAddress: address || null,
      shippingAddress: contact.enderecoEntrega || address || null,
      internalNotes: `Gerada pela programação "${schedule.title}" (${scheduledFor.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}).${schedule.conditions ? ` Condições: ${schedule.conditions}` : ""}`,
      items: { create: rows },
    },
  });
  await addOrderEvent(tx, order.id, null, "created", `Cotação gerada automaticamente pela programação "${schedule.title}".`);
  return order;
}

/**
 * Processa ocorrências vencidas (nextDate ≤ `until`). Cada ocorrência vira
 * uma CustomerScheduleRun única (scheduleId + scheduledFor): rodar o
 * processamento de novo — botão, cron ou os dois juntos — nunca gera a
 * mesma cotação/tarefa duas vezes. `force` processa a próxima ocorrência
 * de uma programação mesmo antes da data ("Gerar agora").
 */
export async function processSchedules(opts: { companyId?: string; scheduleId?: string; until?: Date; force?: boolean; where?: Prisma.CustomerScheduleWhereInput }) {
  const until = opts.until ?? new Date();
  const schedules = await prisma.customerSchedule.findMany({
    where: {
      active: true,
      ...(opts.where ?? {}),
      ...(opts.companyId ? { companyId: opts.companyId } : {}),
      ...(opts.scheduleId ? { id: opts.scheduleId } : {}),
      ...(opts.force ? {} : { nextDate: { lte: until } }),
    },
    include: { items: true },
  });

  let quotes = 0;
  let tasks = 0;
  for (const s of schedules) {
    // Limite de segurança: uma programação esquecida há meses não gera
    // dezenas de cotações de uma vez — no máximo 12 ocorrências por rodada.
    for (let i = 0; i < 12; i++) {
      const fresh = await prisma.customerSchedule.findUniqueOrThrow({ where: { id: s.id }, select: { nextDate: true, active: true } });
      if (!fresh.active) break;
      if (fresh.nextDate > until && !(opts.force && i === 0)) break;
      const scheduledFor = fresh.nextDate;
      const result = await prisma.$transaction(async (tx) => {
        const already = await tx.customerScheduleRun.findUnique({ where: { scheduleId_scheduledFor: { scheduleId: s.id, scheduledFor } } });
        let kind: "quote" | "task" | null = null;
        if (!already) {
          const run = await tx.customerScheduleRun.create({ data: { scheduleId: s.id, scheduledFor } });
          if (s.action === "COTACAO") {
            const order = await createScheduledQuote(tx, s, s.items, scheduledFor);
            if (order) {
              await tx.customerScheduleRun.update({ where: { id: run.id }, data: { orderId: order.id } });
              await tx.task.create({
                data: { ownerId: s.responsibleId, title: `Revisar cotação ${order.number} da programação "${s.title}"`, dueDate: scheduledFor },
              });
              kind = "quote";
            }
          } else {
            const task = await tx.task.create({
              data: { ownerId: s.responsibleId, title: `Programação: ${s.title}`, dueDate: scheduledFor },
            });
            await tx.customerScheduleRun.update({ where: { id: run.id }, data: { taskId: task.id } });
            kind = "task";
          }
        }
        // Avança mesmo que a ocorrência já existisse (execução concorrente).
        await tx.customerSchedule.updateMany({
          where: { id: s.id, nextDate: scheduledFor },
          data: { nextDate: addDays(scheduledFor, s.frequencyDays) },
        });
        return kind;
      });
      if (result === "quote") quotes++;
      if (result === "task") tasks++;
    }
  }
  return { schedules: schedules.length, quotes, tasks };
}

/** Datas das próximas ocorrências dentro da janela, para o calendário. */
export function upcomingOccurrences(nextDate: Date, frequencyDays: number, windowDays: number) {
  const end = addDays(new Date(), windowDays);
  const dates: Date[] = [];
  let d = new Date(nextDate);
  while (d <= end && dates.length < 60) {
    dates.push(d);
    d = addDays(d, frequencyDays);
  }
  return dates;
}
