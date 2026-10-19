import { prisma } from "@/lib/prisma";
import { requireCustomer, companyLabel } from "@/lib/erp/portal";
import { Badge, Card, EmptyState, PageHeader } from "@/components/erp/ui";
import { fmtDate } from "@/lib/erp/format";
import { RequestForm } from "@/components/portal/RequestForm";
import { createPortalRequest } from "../actions";

function frequencyLabel(days: number) {
  if (days === 7) return "Semanal";
  if (days === 15 || days === 14) return "Quinzenal";
  if (days === 30) return "Mensal";
  if (days === 60) return "Bimestral";
  if (days === 90) return "Trimestral";
  return `A cada ${days} dias`;
}

export default async function PortalSchedules() {
  const { contactId } = await requireCustomer();
  const schedules = await prisma.customerSchedule.findMany({
    where: { contactId },
    orderBy: [{ active: "desc" }, { nextDate: "asc" }],
    select: {
      id: true, title: true, frequencyDays: true, nextDate: true, active: true, conditions: true,
      company: { select: { name: true, tradeName: true } },
      items: { select: { id: true, quantity: true, product: { select: { sku: true, name: true, unit: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Programações" subtitle="Entregas recorrentes combinadas com a MAX LED." />
      {schedules.length === 0 ? (
        <EmptyState>Nenhuma programação cadastrada.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {schedules.map((s) => (
            <Card
              key={s.id}
              title={s.title}
              actions={s.active ? <Badge tone="good">Ativa</Badge> : <Badge>Inativa</Badge>}
            >
              <p className="text-sm text-ink-muted">
                {companyLabel(s.company)} · {frequencyLabel(s.frequencyDays)} · próxima em{" "}
                <span className="font-semibold text-ink">{fmtDate(s.nextDate)}</span>
              </p>
              <ul className="mt-2 divide-y divide-gold-deep/20 text-sm">
                {s.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2 py-1.5">
                    <span>
                      {i.product.name} <span className="text-xs text-ink-faint">{i.product.sku}</span>
                    </span>
                    <span className="tabular-nums">
                      {i.quantity} {i.product.unit}
                    </span>
                  </li>
                ))}
              </ul>
              {s.conditions && <p className="mt-2 whitespace-pre-line text-xs text-ink-muted">{s.conditions}</p>}
            </Card>
          ))}
        </div>
      )}
      <Card title="Solicitar alteração de programação">
        <RequestForm
          action={createPortalRequest}
          types={[{ value: "PROGRAMACAO", label: "Alteração de programação" }]}
          placeholder="Ex.: incluir 500 LEDs na programação mensal a partir do próximo mês."
        />
      </Card>
    </div>
  );
}
