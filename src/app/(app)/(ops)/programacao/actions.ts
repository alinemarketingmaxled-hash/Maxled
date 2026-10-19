"use server";

import { z } from "zod";
import { requireEditAction } from "@/lib/require-permission";
import { activeCompanyId } from "@/lib/erp/company";
import { runAction, str, int, date, bool, type ActionResult } from "@/lib/erp/action-result";
import { processSchedules, saveSchedule, scheduleScopeWhere } from "@/lib/erp/schedules";

const itemsSchema = z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() }));

export async function saveScheduleAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("programacao");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    let items: z.infer<typeof itemsSchema>;
    try {
      const parsed = itemsSchema.safeParse(JSON.parse(str(fd, "items") ?? "[]"));
      if (!parsed.success) throw new Error();
      items = parsed.data;
    } catch {
      throw new Error("Itens inválidos.");
    }
    const nextDate = date(fd, "nextDate");
    if (!nextDate) throw new Error("Informe a próxima data.");
    const id = str(fd, "scheduleId") ?? undefined;
    const schedule = await saveSchedule(
      session,
      companyId,
      {
        contactId: str(fd, "contactId") ?? "",
        responsibleId: str(fd, "responsibleId") ?? "",
        title: str(fd, "title") ?? "",
        frequencyDays: int(fd, "frequencyDays") ?? 0,
        nextDate,
        action: str(fd, "action") ?? "COTACAO",
        conditions: str(fd, "conditions"),
        notes: str(fd, "notes"),
        active: bool(fd, "active"),
        items,
      },
      id,
    );
    return { ok: true, message: "Programação salva.", redirectTo: `/programacao/${schedule.id}` };
  });
}

/** "Processar vencidas" (todas do escopo) ou "Gerar agora" (uma só). */
export async function processSchedulesAction(fd: FormData): Promise<ActionResult> {
  const session = await requireEditAction("programacao");
  const companyId = await activeCompanyId(session);
  return runAction(async () => {
    const scheduleId = str(fd, "scheduleId") ?? undefined;
    const res = await processSchedules({
      companyId,
      scheduleId,
      force: Boolean(scheduleId),
      where: scheduleScopeWhere(session, companyId),
    });
    const parts = [res.quotes && `${res.quotes} cotação(ões)`, res.tasks && `${res.tasks} tarefa(s)`].filter(Boolean);
    return { ok: true, message: parts.length ? `Gerado: ${parts.join(" e ")}.` : "Nada a gerar agora." };
  });
}
