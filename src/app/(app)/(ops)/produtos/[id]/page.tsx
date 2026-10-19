import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit, canSeeCosts, canView } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCompanyContext } from "@/lib/erp/company";
import { KIND_LABELS, ORIGIN_LABELS } from "@/lib/erp/products";
import { availabilityFor, available, MOVEMENT_LABELS } from "@/lib/erp/stock";
import { fmtDateTime, fmtMoney, fmtNumber } from "@/lib/erp/format";
import { PageHeader, Card, Kpi, Table, thCls, tdCls, Badge, NoCompany, btnPrimary, btnSecondary } from "@/components/erp/ui";
import { BackLink } from "@/components/shell/BackLink";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-[13px] text-ink">{value || "-"}</dd>
    </div>
  );
}

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("produtos");
  const { id } = await params;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const companyId = ctx.active.id;
  const p = await prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      components: { include: { component: { select: { id: true, sku: true, name: true, stockPhysical: true, stockReserved: true, stockBlocked: true } } } },
      usedInKits: { include: { kit: { select: { id: true, sku: true, name: true } } } },
      suppliers: { include: { supplier: { select: { name: true } } } },
    },
  });
  if (!p) notFound();
  const role = session.user.role;
  const seeCosts = canSeeCosts(role);
  const isKit = p.components.length > 0;
  const [avail, movements] = await Promise.all([
    availabilityFor(companyId, [p.id]),
    isKit
      ? Promise.resolve([])
      : prisma.stockMovement.findMany({
          where: { companyId, productId: p.id },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { user: { select: { name: true } } },
        }),
  ]);
  const showStockLinks = canView(role, "estoque");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <BackLink href="/produtos" label="Produtos" />
        <PageHeader
          title={`${p.sku} · ${p.name}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {p.family} · {isKit ? "Kit comercial" : KIND_LABELS[p.kind]} {!p.active && <Badge>Inativo</Badge>}
            </span>
          }
          actions={
            <>
              {showStockLinks && !isKit && (
                <Link href={`/estoque?aba=movimentos&produto=${p.id}`} className={btnSecondary}>
                  Movimentações
                </Link>
              )}
              {canEdit(role, "produtos") && (
                <Link href={`/produtos/${p.id}/editar`} className={btnPrimary}>
                  Editar
                </Link>
              )}
            </>
          }
        />
      </div>

      {isKit ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Kits disponíveis" value={fmtNumber(avail.get(p.id) ?? 0)} hint="Calculado pelos componentes" />
          <Kpi label="Preço" value={fmtMoney(p.price)} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Físico" value={fmtNumber(p.stockPhysical)} />
          <Kpi label="Reservado" value={fmtNumber(p.stockReserved)} />
          <Kpi label="Bloqueado" value={fmtNumber(p.stockBlocked)} />
          <Kpi
            label="Disponível"
            value={fmtNumber(available(p))}
            tone={p.minStock > 0 && available(p) < p.minStock ? "warning" : undefined}
            hint={p.minStock > 0 ? `Mínimo ${fmtNumber(p.minStock)}` : undefined}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Dados comerciais e fiscais">
          <dl className="grid grid-cols-2 gap-3">
            <Info label="Preço de venda" value={fmtMoney(p.price)} />
            <Info label="Preço mínimo" value={p.minPrice ? fmtMoney(p.minPrice) : "-"} />
            {seeCosts && <Info label="Custo" value={fmtMoney(p.cost)} />}
            {seeCosts && (
              <Info
                label="Margem"
                value={Number(p.price) > 0 && Number(p.cost) > 0 ? `${(((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100).toFixed(1)}%` : "-"}
              />
            )}
            <Info label="NCM" value={p.ncm} />
            <Info label="CEST" value={p.cest} />
            <Info label="Origem" value={ORIGIN_LABELS[p.origin]} />
            <Info label="Unidade" value={`${p.unit}${p.packQty > 1 ? ` (${p.packQty} por embalagem)` : ""}`} />
            <Info label="Código de barras" value={p.barcode} />
            <Info label="Código do fabricante" value={p.manufacturerCode} />
            <Info label="Marca" value={p.brand} />
            <Info label="Categoria" value={p.category} />
            <Info label="Reposição" value={p.reorderQty ? fmtNumber(p.reorderQty) : "-"} />
            <Info
              label="Peso / dimensões"
              value={`${p.weightKg ? `${p.weightKg.toString()} kg` : "-"} · ${[p.lengthCm, p.widthCm, p.heightCm].map((d) => d?.toString() ?? "?").join(" x ")} cm`}
            />
          </dl>
          {(p.datasheetUrl || p.imageUrl) && (
            <div className="mt-3 flex gap-3 text-xs">
              {p.imageUrl && (
                <a href={p.imageUrl} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                  Foto
                </a>
              )}
              {p.datasheetUrl && (
                <a href={p.datasheetUrl} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                  Ficha técnica
                </a>
              )}
            </div>
          )}
        </Card>

        <Card title="Descrição técnica">
          <p className="whitespace-pre-wrap text-[13px] text-ink">{p.description || "-"}</p>
          {p.technicalSpecs && (
            <>
              <h4 className="mt-3 text-[10.5px] uppercase tracking-wide text-ink-faint">Especificações</h4>
              <p className="whitespace-pre-wrap text-[13px] text-ink">{p.technicalSpecs}</p>
            </>
          )}
        </Card>
      </div>

      {isKit && (
        <Card title="Componentes do kit">
          <Table
            head={
              <>
                <th className={thCls}>SKU</th>
                <th className={thCls}>Componente</th>
                <th className={`${thCls} text-right`}>Qtd. por kit</th>
                <th className={`${thCls} text-right`}>Disponível</th>
              </>
            }
          >
            {p.components.map((c) => (
              <tr key={c.id}>
                <td className={`${tdCls} font-mono text-xs`}>
                  <Link href={`/produtos/${c.component.id}`} className="text-gold hover:underline">
                    {c.component.sku}
                  </Link>
                </td>
                <td className={tdCls}>{c.component.name}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(c.quantity)}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(available(c.component))}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {p.usedInKits.length > 0 && (
        <Card title="Kits que usam este produto">
          <ul className="flex flex-col gap-1 text-[13px]">
            {p.usedInKits.map((k) => (
              <li key={k.id}>
                <Link href={`/produtos/${k.kit.id}`} className="text-gold hover:underline">
                  {k.kit.sku}
                </Link>{" "}
                {k.kit.name} · {k.quantity} un. por kit
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p.suppliers.length > 0 && (
        <Card title="Fornecedores">
          <Table
            head={
              <>
                <th className={thCls}>Fornecedor</th>
                <th className={thCls}>Código</th>
                {seeCosts && <th className={`${thCls} text-right`}>Último custo</th>}
                <th className={`${thCls} text-right`}>Prazo</th>
              </>
            }
          >
            {p.suppliers.map((x) => (
              <tr key={x.supplierId}>
                <td className={tdCls}>{x.supplier.name}</td>
                <td className={tdCls}>{x.supplierSku ?? "-"}</td>
                {seeCosts && <td className={`${tdCls} text-right tabular-nums`}>{x.lastCost ? fmtMoney(x.lastCost) : "-"}</td>}
                <td className={`${tdCls} text-right`}>{x.leadTimeDays ? `${x.leadTimeDays} dias` : "-"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {!isKit && (
        <Card title="Últimas movimentações">
          {movements.length === 0 ? (
            <p className="text-xs text-ink-muted">Sem movimentações.</p>
          ) : (
            <Table
              head={
                <>
                  <th className={thCls}>Data</th>
                  <th className={thCls}>Tipo</th>
                  <th className={`${thCls} text-right`}>Qtd.</th>
                  <th className={`${thCls} text-right`}>Físico após</th>
                  <th className={thCls}>Motivo</th>
                  <th className={thCls}>Usuário</th>
                </>
              }
            >
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className={`${tdCls} whitespace-nowrap`}>{fmtDateTime(m.createdAt)}</td>
                  <td className={tdCls}>{MOVEMENT_LABELS[m.type]}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(m.quantity)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(m.physicalAfter)}</td>
                  <td className={tdCls}>{m.reason ?? "-"}</td>
                  <td className={tdCls}>{m.user?.name ?? "Sistema"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
