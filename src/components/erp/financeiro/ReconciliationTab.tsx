import { prisma } from "@/lib/prisma";
import { fmtDate, fmtMoney } from "@/lib/erp/format";
import { ActionButton } from "@/components/erp/ActionForm";
import { Badge, EmptyState, Table, Tabs, btnSecondary, tdCls, thCls } from "@/components/erp/ui";
import { toggleReconciledAction } from "@/app/(app)/(ops)/financeiro/actions";
import { buildQuery } from "./shared";

/** Conciliação: cada baixa (entrada ou saída) conferida contra o extrato.
 * Sem integração bancária nesta versão, a conferência é manual. */
export async function ReconciliationTab({ companyId, pendingOnly, editable }: { companyId: string; pendingOnly: boolean; editable: boolean }) {
  const filter = pendingOnly ? { reconciled: false } : {};
  const [ins, outs] = await Promise.all([
    prisma.receivablePayment.findMany({
      where: { receivable: { companyId }, ...filter },
      orderBy: { paidAt: "desc" },
      take: 150,
      include: { receivable: { select: { description: true, contact: { select: { firstName: true, lastName: true, accountName: true } } } } },
    }),
    prisma.payablePayment.findMany({
      where: { payable: { companyId }, ...filter },
      orderBy: { paidAt: "desc" },
      take: 150,
      include: { payable: { select: { description: true, supplier: { select: { name: true } } } } },
    }),
  ]);
  const rows = [
    ...ins.map((p) => ({
      id: p.id, kind: "receivable" as const, paidAt: p.paidAt, amount: p.amount.toNumber(), method: p.method, reconciled: p.reconciled,
      party: p.receivable.contact.accountName || `${p.receivable.contact.firstName} ${p.receivable.contact.lastName}`,
      description: p.receivable.description,
    })),
    ...outs.map((p) => ({
      id: p.id, kind: "payable" as const, paidAt: p.paidAt, amount: p.amount.toNumber(), method: p.method, reconciled: p.reconciled,
      party: p.payable.supplier?.name ?? "-", description: p.payable.description,
    })),
  ].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        tabs={[
          { key: "pend", label: "Não conciliados", href: buildQuery({ aba: "conciliacao" }, { pend: "1" }) },
          { key: "todos", label: "Todos os lançamentos", href: buildQuery({ aba: "conciliacao" }, { pend: "0" }) },
        ]}
        active={pendingOnly ? "pend" : "todos"}
      />
      {rows.length === 0 ? (
        <EmptyState>{pendingOnly ? "Todas as baixas estão conciliadas." : "Nenhuma baixa registrada."}</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Data</th>
              <th className={thCls}>Tipo</th>
              <th className={thCls}>Cliente / fornecedor</th>
              <th className={thCls}>Descrição</th>
              <th className={thCls}>Forma</th>
              <th className={`${thCls} text-right`}>Valor</th>
              <th className={thCls}>Conciliação</th>
            </>
          }
        >
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.id}`}>
              <td className={tdCls}>{fmtDate(r.paidAt)}</td>
              <td className={tdCls}>{r.kind === "receivable" ? <Badge tone="good">Entrada</Badge> : <Badge tone="critical">Saída</Badge>}</td>
              <td className={tdCls}>{r.party}</td>
              <td className={tdCls}>{r.description}</td>
              <td className={tdCls}>{r.method ?? "-"}</td>
              <td className={`${tdCls} text-right tabular-nums`}>
                {r.kind === "payable" ? "-" : ""}
                {fmtMoney(r.amount)}
              </td>
              <td className={tdCls}>
                <span className="flex flex-wrap items-center gap-2">
                  {r.reconciled ? <Badge tone="good">Conciliado</Badge> : <Badge tone="warning">Pendente</Badge>}
                  {editable && (
                    <ActionButton action={toggleReconciledAction} fields={{ kind: r.kind, id: r.id }} className={btnSecondary}>
                      {r.reconciled ? "Desfazer" : "Conciliar"}
                    </ActionButton>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
