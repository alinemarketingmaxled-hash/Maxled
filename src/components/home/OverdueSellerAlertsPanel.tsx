export type OverdueSellerAlert = { ownerId: string; ownerName: string; count: number };

/** Mediator-only radar for sellers piling up overdue tasks/agendamentos —
 * only rendered when the list is non-empty (page only fetches it for
 * MEDIATOR sessions, see getOverdueSellerAlerts). */
export function OverdueSellerAlertsPanel({ alerts }: { alerts: OverdueSellerAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-critical/40 bg-critical/[0.06] p-4">
      <div className="mb-2.5">
        <h3 className="font-display text-lg text-critical">⚠ Vendedores com muitos atrasos</h3>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          5 ou mais tarefas/agendamentos atrasados no total — vale dar uma olhada
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {alerts.map((a) => (
          <div
            key={a.ownerId}
            className="flex items-center gap-2 rounded-lg border border-critical/30 bg-surface px-3 py-2"
          >
            <span className="text-[12.5px] font-semibold text-ink">{a.ownerName}</span>
            <span className="rounded-full bg-critical px-2 py-0.5 text-[11px] font-bold text-white">
              {a.count} atrasado{a.count !== 1 ? "s" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
