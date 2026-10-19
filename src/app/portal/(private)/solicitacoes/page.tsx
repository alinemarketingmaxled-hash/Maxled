import { prisma } from "@/lib/prisma";
import { requireCustomer, REQUEST_TYPE_LABELS } from "@/lib/erp/portal";
import { Badge, Card, EmptyState, PageHeader } from "@/components/erp/ui";
import { fmtDateTime } from "@/lib/erp/format";
import { RequestForm } from "@/components/portal/RequestForm";
import { createPortalRequest } from "../actions";

export default async function PortalRequests() {
  const { contactId } = await requireCustomer();
  const requests = await prisma.portalRequest.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, type: true, message: true, status: true, response: true, createdAt: true, resolvedAt: true },
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div>
        <PageHeader title="Solicitações" subtitle="Atualização cadastral, contato e alterações de programação." />
        <Card title="Nova solicitação">
          <RequestForm
            action={createPortalRequest}
            types={Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            placeholder="Descreva o que precisa. Para atualização cadastral, informe os novos dados."
          />
        </Card>
      </div>
      <div className="flex flex-col gap-3 lg:pt-[60px]">
        {requests.length === 0 ? (
          <EmptyState>Nenhuma solicitação enviada.</EmptyState>
        ) : (
          requests.map((r) => (
            <Card
              key={r.id}
              title={REQUEST_TYPE_LABELS[r.type] ?? r.type}
              actions={r.status === "RESOLVIDA" ? <Badge tone="good">Respondida</Badge> : <Badge tone="warning">Em análise</Badge>}
            >
              <p className="text-[11px] text-ink-faint">{fmtDateTime(r.createdAt)}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">{r.message}</p>
              {r.response && (
                <div className="mt-3 rounded-lg border border-gold-deep/30 bg-surface-2 p-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gold">Resposta MAX LED · {fmtDateTime(r.resolvedAt)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink">{r.response}</p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
