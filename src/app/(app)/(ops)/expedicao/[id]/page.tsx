import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { canEdit, canView } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { reachedStatus } from "@/lib/erp/orders";
import { fmtDateTime, orderCode } from "@/lib/erp/format";
import { Badge, Card, Field, NoCompany, PageHeader, Table, thCls, tdCls, inputCls, btnPrimary, btnSecondary } from "@/components/erp/ui";
import { ActionButton, ActionForm } from "@/components/erp/ActionForm";
import { BackLink } from "@/components/shell/BackLink";
import { OrderStatusBadge } from "@/components/erp/pedidos/OrderStatusBadge";
import { PrintButton } from "@/components/erp/expedicao/PrintButton";
import { advanceShippingAction, returnAction, shippingIssueAction } from "../actions";

export default async function ExpedicaoPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("expedicao");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const { id } = await params;
  const order = await prisma.salesOrder.findFirst({
    where: { id, companyId: ctx.active.id },
    include: {
      contact: true,
      items: {
        orderBy: { position: "asc" },
        include: {
          product: {
            select: {
              id: true, sku: true, name: true, unit: true, weightKg: true,
              components: { select: { quantity: true, component: { select: { id: true, sku: true, name: true, unit: true } } } },
            },
          },
        },
      },
      fiscalDocuments: { where: { activeKey: { not: null } } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!order) notFound();

  const editable = canEdit(session.user.role, "expedicao");
  const canReturn = editable || canEdit(session.user.role, "estoque");
  const nf = order.fiscalDocuments[0];
  const nfOk = nf?.status === "AUTORIZADA";
  const code = orderCode(ctx.active.code, order.number);
  const fields = { orderId: order.id };

  // Lista de separação: kits viram as peças físicas que saem da prateleira.
  const pickLines = order.items.flatMap((i) =>
    i.product.components.length > 0
      ? i.product.components.map((c) => ({
          key: `${i.id}:${c.component.id}`,
          productId: c.component.id,
          sku: c.component.sku,
          name: c.component.name,
          unit: c.component.unit,
          quantity: c.quantity * i.quantity,
          origin: `${i.quantity}x kit ${i.product.sku}`,
        }))
      : [{ key: i.id, productId: i.product.id, sku: i.product.sku, name: i.product.name, unit: i.product.unit, quantity: i.quantity, origin: null as string | null }],
  );
  const returnOptions = [...new Map(pickLines.map((l) => [l.productId, l])).values()];

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <BackLink href="/expedicao" label="Expedição" />
      </div>
      <PageHeader
        title={`Expedição ${code}`}
        subtitle={`${order.contact.accountName || `${order.contact.firstName} ${order.contact.lastName}`} · ${[order.contact.city, order.contact.state].filter(Boolean).join("/")}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            {nfOk ? <Badge tone="good">NF-e {nf.number} autorizada</Badge> : <Badge tone="warning">NF-e pendente</Badge>}
            {canView(session.user.role, "pedidos") && (
              <Link href={`/pedidos/${order.id}`} className={`${btnSecondary} print:hidden`}>Ver pedido</Link>
            )}
            <PrintButton />
          </>
        }
      />

      <Card title="Lista de separação">
        <Table
          head={
            <>
              <th className={thCls}>Conferido</th>
              <th className={thCls}>SKU</th>
              <th className={thCls}>Produto</th>
              <th className={`${thCls} text-right`}>Qtd a separar</th>
              <th className={thCls}>Lote / série</th>
            </>
          }
        >
          {pickLines.map((l) => (
            <tr key={l.key}>
              <td className={tdCls}>
                <span className="inline-block h-4 w-4 rounded border border-gold-deep" aria-hidden />
              </td>
              <td className={`${tdCls} font-semibold`}>{l.sku}</td>
              <td className={tdCls}>
                {l.name}
                {l.origin && <span className="block text-[11px] text-ink-faint">{l.origin}</span>}
              </td>
              <td className={`${tdCls} text-right tabular-nums`}>{l.quantity} {l.unit}</td>
              <td className={tdCls}>
                <span className="inline-block w-28 border-b border-dashed border-gold-deep/50">&nbsp;</span>
              </td>
            </tr>
          ))}
        </Table>
        {order.shippingAddress && <p className="mt-2 text-xs text-ink-muted">Entrega: {order.shippingAddress}</p>}
        {order.notes && <p className="mt-1 text-xs text-ink-muted">Obs.: {order.notes}</p>}
      </Card>

      {editable && (
        <Card title="Próxima etapa" className="print:hidden">
          {order.status === "APROVADO" && (
            <ActionButton action={advanceShippingAction} fields={{ ...fields, step: "start_picking" }} className={btnPrimary}>
              Iniciar separação
            </ActionButton>
          )}
          {order.status === "EM_SEPARACAO" && (
            <ActionButton action={advanceShippingAction} fields={{ ...fields, step: "picked" }} className={btnPrimary}>
              Separação concluída
            </ActionButton>
          )}
          {order.status === "EM_CONFERENCIA" && (
            <ActionForm action={advanceShippingAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="step" value="checked" />
              <Field label="Volumes *">
                <input type="number" name="packages" min={1} required className={inputCls} />
              </Field>
              <Field label="Peso bruto (kg)">
                <input type="number" name="grossWeightKg" min={0} step="0.001" className={inputCls} />
              </Field>
              <Field label="Dimensões (cm)">
                <input name="dimensions" placeholder="Ex.: 40x30x20" className={inputCls} />
              </Field>
              <div className="flex items-end">
                <button className={btnPrimary}>Conferido e embalado</button>
              </div>
              <p className="text-[11px] text-ink-faint sm:col-span-2 lg:col-span-4">
                A conferência deve ser feita por quem não separou o pedido.
              </p>
            </ActionForm>
          )}
          {order.status === "PRONTO_EXPEDICAO" &&
            (nfOk ? (
              <ActionForm action={advanceShippingAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="step" value="dispatch" />
                <Field label="Transportadora *">
                  <input name="carrier" required defaultValue={order.carrier ?? ""} className={inputCls} />
                </Field>
                <Field label="Modalidade">
                  <input name="shippingMode" defaultValue={order.shippingMode ?? ""} className={inputCls} />
                </Field>
                <Field label="Frete por conta de">
                  <select name="freightPayer" defaultValue={order.freightPayer ?? ""} className={inputCls}>
                    <option value="">A definir</option>
                    <option value="CIF">CIF (emitente)</option>
                    <option value="FOB">FOB (destinatário)</option>
                  </select>
                </Field>
                <Field label="Código de rastreamento">
                  <input name="trackingCode" className={inputCls} />
                </Field>
                <div className="sm:col-span-2 lg:col-span-4">
                  <button className={btnPrimary}>Despachar (baixa no estoque)</button>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-warning">
                Aguardando NF-e autorizada para liberar o despacho.
                {canView(session.user.role, "pedidos") && (
                  <Link href={`/pedidos/${order.id}`} className="ml-1 text-gold underline">Emitir pelo pedido</Link>
                )}
              </p>
            ))}
          {order.status === "ENVIADO" && (
            <ActionButton action={advanceShippingAction} fields={{ ...fields, step: "delivered" }} className={btnPrimary} confirm="Confirmar a entrega ao cliente?">
              Confirmar entrega
            </ActionButton>
          )}
          {(order.status === "ENTREGUE" || order.status === "CANCELADO" || !reachedStatus(order.status, "APROVADO")) && (
            <p className="text-sm text-ink-muted">Nenhuma etapa de expedição pendente.</p>
          )}
        </Card>
      )}

      <div className="grid gap-4 print:hidden lg:grid-cols-2">
        <Card title="Ocorrências">
          {order.shippingIssue ? (
            <pre className="mb-3 whitespace-pre-wrap rounded-md bg-warning/10 p-2 text-xs text-warning">{order.shippingIssue}</pre>
          ) : (
            <p className="mb-3 text-sm text-ink-muted">Nenhuma ocorrência.</p>
          )}
          {editable && (
            <ActionForm action={shippingIssueAction} resetOnSuccess className="flex flex-col gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <textarea name="issue" rows={2} required placeholder="Atraso, avaria no transporte, endereço incorreto..." className={inputCls} />
              <div>
                <button className={btnSecondary}>Registrar ocorrência</button>
              </div>
            </ActionForm>
          )}
        </Card>

        {canReturn && reachedStatus(order.status, "ENVIADO") && (
          <Card title="Devolução">
            <ActionForm action={returnAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="orderId" value={order.id} />
              <Field label="Produto" className="sm:col-span-2">
                <select name="productId" required className={inputCls}>
                  {returnOptions.map((o) => (
                    <option key={o.productId} value={o.productId}>
                      {o.sku} · {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantidade">
                <input type="number" name="quantity" min={1} required className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink-muted">
                <input type="checkbox" name="damaged" /> Mercadoria avariada (bloquear)
              </label>
              <Field label="Motivo" className="sm:col-span-2">
                <input name="reason" required className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <button className={btnSecondary}>Registrar devolução</button>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>

      <Card title="Histórico" className="print:hidden">
        <ol className="flex flex-col gap-2 text-sm">
          {order.events.map((e) => (
            <li key={e.id} className="border-l-2 border-gold-deep/40 pl-3">
              <p>{e.message}</p>
              <p className="text-[11px] text-ink-faint">{fmtDateTime(e.createdAt)} · {e.userName ?? "Sistema"}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
