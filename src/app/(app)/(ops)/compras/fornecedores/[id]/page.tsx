import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit, canSeeCosts, canView } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtMoney } from "@/lib/erp/format";
import { PURCHASE_STATUS_LABELS } from "@/lib/erp/purchasing";
import { FIN_STATUS_LABELS } from "@/lib/erp/finance";
import { PageHeader, Card, Table, thCls, tdCls, Badge, NoCompany, btnPrimary, btnDanger, btnSecondary, EmptyState } from "@/components/erp/ui";
import { ActionForm, ActionButton } from "@/components/erp/ActionForm";
import { SupplierFields } from "@/components/erp/compras/SupplierFields";
import { updateSupplierAction, deleteSupplierAction } from "../actions";

export default async function FornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("compras");
  let companyId: string;
  try {
    companyId = (await getCompanyContext(session)).active.id;
  } catch {
    return <NoCompany />;
  }
  const { id } = await params;
  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      products: { include: { product: { select: { id: true, sku: true, name: true } } } },
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, number: true, status: true, createdAt: true, currency: true } },
    },
  });
  if (!supplier) notFound();
  const showFin = canView(session.user.role, "financeiro");
  const payables = showFin
    ? await prisma.payable.findMany({
        where: { companyId, supplierId: supplier.id, status: { in: ["ABERTO", "PARCIAL"] } },
        orderBy: { dueDate: "asc" },
      })
    : [];
  const editable = canEdit(session.user.role, "compras");
  const costs = canSeeCosts(session.user.role);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={supplier.name}
        subtitle={`${supplier.country} · ${supplier.currency}${supplier.rating ? ` · avaliação ${supplier.rating}/5` : ""}`}
        actions={
          <>
            <Link href="/compras/fornecedores" className={btnSecondary}>Voltar</Link>
            {editable && (
              <ActionButton action={deleteSupplierAction} fields={{ id: supplier.id }} className={btnDanger} confirm="Excluir este fornecedor?">
                Excluir
              </ActionButton>
            )}
          </>
        }
      />
      <Card title="Cadastro">
        <ActionForm action={updateSupplierAction}>
          <input type="hidden" name="id" value={supplier.id} />
          <SupplierFields s={supplier} disabled={!editable} />
          {editable && <div className="mt-4"><button className={btnPrimary}>Salvar alterações</button></div>}
        </ActionForm>
      </Card>

      <Card title="Produtos fornecidos">
        {supplier.products.length === 0 ? (
          <EmptyState>Nenhum produto vinculado. O vínculo é criado automaticamente no primeiro recebimento.</EmptyState>
        ) : (
          <Table head={<><th className={thCls}>SKU</th><th className={thCls}>Produto</th><th className={thCls}>Código no fornecedor</th>{costs && <th className={thCls}>Último custo</th>}<th className={thCls}>Prazo</th></>}>
            {supplier.products.map((p) => (
              <tr key={p.productId}>
                <td className={tdCls}>{p.product.sku}</td>
                <td className={tdCls}>{p.product.name}</td>
                <td className={tdCls}>{p.supplierSku ?? "-"}</td>
                {costs && <td className={`${tdCls} tabular-nums`}>{p.lastCost ? fmtMoney(p.lastCost) : "-"}</td>}
                <td className={tdCls}>{p.leadTimeDays ? `${p.leadTimeDays} dias` : "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Histórico de compras">
        {supplier.purchaseOrders.length === 0 ? (
          <EmptyState>Nenhuma compra com este fornecedor.</EmptyState>
        ) : (
          <Table head={<><th className={thCls}>Compra</th><th className={thCls}>Data</th><th className={thCls}>Moeda</th><th className={thCls}>Status</th></>}>
            {supplier.purchaseOrders.map((po) => (
              <tr key={po.id}>
                <td className={tdCls}><Link href={`/compras/${po.id}`} className="font-semibold text-gold hover:underline">#{po.number}</Link></td>
                <td className={tdCls}>{fmtDate(po.createdAt)}</td>
                <td className={tdCls}>{po.currency}</td>
                <td className={tdCls}><Badge>{PURCHASE_STATUS_LABELS[po.status]}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {showFin && (
        <Card title="Contas a pagar em aberto">
          {payables.length === 0 ? (
            <EmptyState>Nenhuma conta em aberto.</EmptyState>
          ) : (
            <Table head={<><th className={thCls}>Descrição</th><th className={thCls}>Vencimento</th><th className={thCls}>Valor</th><th className={thCls}>Pago</th><th className={thCls}>Status</th></>}>
              {payables.map((p) => (
                <tr key={p.id}>
                  <td className={tdCls}>{p.description}</td>
                  <td className={tdCls}>{fmtDate(p.dueDate)}</td>
                  <td className={`${tdCls} tabular-nums`}>{fmtMoney(p.amount)}</td>
                  <td className={`${tdCls} tabular-nums`}>{fmtMoney(p.paidAmount)}</td>
                  <td className={tdCls}><Badge tone={p.dueDate < new Date() ? "critical" : "neutral"}>{FIN_STATUS_LABELS[p.status]}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
