import Link from "next/link";
import type { Prisma, StockMovementType } from "@/generated/prisma/client";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCompanyContext } from "@/lib/erp/company";
import { PRODUCT_FAMILIES } from "@/lib/erp/products";
import { MANUAL_TYPES } from "@/lib/erp/inventory";
import { availabilityFor, available, MOVEMENT_LABELS } from "@/lib/erp/stock";
import { fmtDateTime, fmtNumber } from "@/lib/erp/format";
import { PageHeader, Card, Kpi, Table, Tabs, thCls, tdCls, Badge, NoCompany, EmptyState, inputCls, btnSecondary } from "@/components/erp/ui";
import { MovementForm, InventoryCountForm, TransferForm } from "@/components/erp/estoque/StockForms";
import { manualMovementAction, inventoryAction, transferAction } from "./actions";

type Params = {
  aba?: string;
  familia?: string;
  filtro?: string;
  q?: string;
  produto?: string;
  tipo?: string;
  de?: string;
  ate?: string;
  documento?: string;
};

const ALL_TYPES = Object.keys(MOVEMENT_LABELS) as StockMovementType[];

function docLink(type: string | null, id: string | null) {
  if (!type || !id) return null;
  if (type === "SalesOrder") return { href: `/pedidos/${id}`, label: "Pedido" };
  if (type === "PurchaseOrder") return { href: `/compras/${id}`, label: "Compra" };
  return null;
}

export default async function EstoquePage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireView("estoque");
  const params = await searchParams;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const companyId = ctx.active.id;
  const editable = canEdit(session.user.role, "estoque");
  const tab = params.aba ?? "saldos";

  const tabs = [
    { key: "saldos", label: "Saldos", href: "/estoque" },
    { key: "movimentos", label: "Movimentações", href: "/estoque?aba=movimentos" },
    ...(editable
      ? [
          { key: "lancar", label: "Lançar movimento", href: "/estoque?aba=lancar" },
          { key: "inventario", label: "Inventário", href: "/estoque?aba=inventario" },
          { key: "transferencias", label: "Transferências", href: "/estoque?aba=transferencias" },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader title="Estoque" subtitle={`Saldos físico, reservado, bloqueado e disponível · empresa ${ctx.active.code}`} />
      <Tabs tabs={tabs} active={tab} />
      {tab === "movimentos" ? (
        <Movements companyId={companyId} params={params} />
      ) : tab === "lancar" && editable ? (
        <Launch companyId={companyId} />
      ) : tab === "inventario" && editable ? (
        <Inventory companyId={companyId} family={params.familia} />
      ) : tab === "transferencias" && editable ? (
        <Transfers companyId={companyId} companies={ctx.companies} />
      ) : (
        <Balances companyId={companyId} params={params} />
      )}
    </div>
  );
}

async function Balances({ companyId, params }: { companyId: string; params: Params }) {
  const q = params.q?.trim();
  const products = await prisma.product.findMany({
    where: {
      companyId,
      deletedAt: null,
      active: true,
      ...(params.familia ? { family: params.familia } : {}),
      ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ family: "asc" }, { sku: "asc" }],
    include: { _count: { select: { components: true } } },
  });
  const simple = products.filter((p) => p._count.components === 0);
  const kits = products.filter((p) => p._count.components > 0);
  const kitAvail = await availabilityFor(companyId, kits.map((k) => k.id));

  const below = simple.filter((p) => p.minStock > 0 && available(p) < p.minStock);
  const empty = simple.filter((p) => available(p) <= 0);
  const rows = params.filtro === "minimo" ? below : params.filtro === "zerado" ? empty : simple;
  const blocked = simple.reduce((s, p) => s + p.stockBlocked, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Produtos simples" value={fmtNumber(simple.length)} />
        <Kpi label="Abaixo do mínimo" value={fmtNumber(below.length)} tone={below.length ? "warning" : undefined} />
        <Kpi label="Sem saldo disponível" value={fmtNumber(empty.length)} tone={empty.length ? "critical" : undefined} />
        <Kpi label="Unidades bloqueadas" value={fmtNumber(blocked)} hint="Avarias e divergências" />
      </div>

      <form className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input name="q" defaultValue={params.q} placeholder="SKU ou nome" className={inputCls} />
        <select name="familia" defaultValue={params.familia ?? ""} className={inputCls}>
          <option value="">Todas as famílias</option>
          {PRODUCT_FAMILIES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select name="filtro" defaultValue={params.filtro ?? ""} className={inputCls}>
          <option value="">Todos</option>
          <option value="minimo">Abaixo do mínimo</option>
          <option value="zerado">Sem saldo</option>
        </select>
        <button className={btnSecondary}>Filtrar</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState>Nenhum produto neste filtro.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>SKU</th>
              <th className={thCls}>Produto</th>
              <th className={thCls}>Família</th>
              <th className={`${thCls} text-right`}>Físico</th>
              <th className={`${thCls} text-right`}>Reservado</th>
              <th className={`${thCls} text-right`}>Bloqueado</th>
              <th className={`${thCls} text-right`}>Disponível</th>
              <th className={`${thCls} text-right`}>Mínimo</th>
              <th className={thCls}>Situação</th>
            </>
          }
        >
          {rows.map((p) => {
            const a = available(p);
            return (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className={`${tdCls} font-mono text-xs`}>
                  <Link href={`/produtos/${p.id}`} className="text-gold hover:underline">
                    {p.sku}
                  </Link>
                </td>
                <td className={tdCls}>{p.name}</td>
                <td className={tdCls}>{p.family}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(p.stockPhysical)}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(p.stockReserved)}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(p.stockBlocked)}</td>
                <td className={`${tdCls} text-right font-semibold tabular-nums`}>{fmtNumber(a)}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(p.minStock)}</td>
                <td className={tdCls}>
                  {a <= 0 ? (
                    <Badge tone="critical">Sem saldo</Badge>
                  ) : p.minStock > 0 && a < p.minStock ? (
                    <Badge tone="warning">Repor{p.reorderQty ? ` ${fmtNumber(p.reorderQty)}` : ""}</Badge>
                  ) : (
                    <Badge tone="good">OK</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {kits.length > 0 && (
        <Card title="Kits (disponibilidade pelos componentes)">
          <Table
            head={
              <>
                <th className={thCls}>SKU</th>
                <th className={thCls}>Kit</th>
                <th className={`${thCls} text-right`}>Kits disponíveis</th>
              </>
            }
          >
            {kits.map((k) => (
              <tr key={k.id}>
                <td className={`${tdCls} font-mono text-xs`}>
                  <Link href={`/produtos/${k.id}`} className="text-gold hover:underline">
                    {k.sku}
                  </Link>
                </td>
                <td className={tdCls}>{k.name}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(kitAvail.get(k.id) ?? 0)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}

async function Movements({ companyId, params }: { companyId: string; params: Params }) {
  const type = ALL_TYPES.includes(params.tipo as StockMovementType) ? (params.tipo as StockMovementType) : undefined;
  const from = params.de ? new Date(`${params.de}T00:00:00-03:00`) : undefined;
  const to = params.ate ? new Date(`${params.ate}T23:59:59.999-03:00`) : undefined;
  const doc = params.documento?.trim();
  const where: Prisma.StockMovementWhereInput = {
    companyId,
    ...(params.produto ? { productId: params.produto } : {}),
    ...(type ? { type } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(doc ? { OR: [{ documentId: doc }, { reason: { contains: doc, mode: "insensitive" } }] } : {}),
  };
  const [movements, products] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { name: true } }, product: { select: { id: true, sku: true, name: true } } },
    }),
    prisma.product.findMany({
      where: { companyId, deletedAt: null, components: { none: {} } },
      select: { id: true, sku: true },
      orderBy: { sku: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
        <input type="hidden" name="aba" value="movimentos" />
        <select name="produto" defaultValue={params.produto ?? ""} className={inputCls}>
          <option value="">Todos os produtos</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={params.tipo ?? ""} className={inputCls}>
          <option value="">Todos os tipos</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_LABELS[t]}
            </option>
          ))}
        </select>
        <input type="date" name="de" defaultValue={params.de} className={inputCls} aria-label="De" />
        <input type="date" name="ate" defaultValue={params.ate} className={inputCls} aria-label="Até" />
        <input name="documento" defaultValue={params.documento} placeholder="Documento ou motivo" className={inputCls} />
        <button className={btnSecondary}>Filtrar</button>
      </form>
      {movements.length === 0 ? (
        <EmptyState>Nenhuma movimentação encontrada.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Data</th>
              <th className={thCls}>Produto</th>
              <th className={thCls}>Tipo</th>
              <th className={`${thCls} text-right`}>Qtd.</th>
              <th className={`${thCls} text-right`}>Físico / Res. / Bloq. após</th>
              <th className={thCls}>Motivo</th>
              <th className={thCls}>Documento</th>
              <th className={thCls}>Usuário</th>
            </>
          }
        >
          {movements.map((m) => {
            const link = docLink(m.documentType, m.documentId);
            return (
              <tr key={m.id}>
                <td className={`${tdCls} whitespace-nowrap`}>{fmtDateTime(m.createdAt)}</td>
                <td className={tdCls}>
                  <Link href={`/produtos/${m.product.id}`} className="font-mono text-xs text-gold hover:underline">
                    {m.product.sku}
                  </Link>
                </td>
                <td className={tdCls}>{MOVEMENT_LABELS[m.type]}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(m.quantity)}</td>
                <td className={`${tdCls} whitespace-nowrap text-right tabular-nums`}>
                  {m.physicalAfter} / {m.reservedAfter} / {m.blockedAfter}
                </td>
                <td className={tdCls}>
                  {m.reason ?? "-"}
                  {(m.lot || m.serial) && (
                    <span className="block text-[11px] text-ink-faint">
                      {m.lot && `Lote ${m.lot}`} {m.serial && `Série ${m.serial}`}
                    </span>
                  )}
                </td>
                <td className={tdCls}>
                  {link ? (
                    <Link href={link.href} className="text-gold hover:underline">
                      {link.label}
                    </Link>
                  ) : (
                    (m.documentId && m.documentType === "Manual" ? m.documentId : "-")
                  )}
                </td>
                <td className={tdCls}>{m.user?.name ?? "Sistema"}</td>
              </tr>
            );
          })}
        </Table>
      )}
      {movements.length === 300 && <p className="text-xs text-ink-faint">Mostrando as 300 mais recentes. Refine os filtros.</p>}
    </div>
  );
}

async function Launch({ companyId }: { companyId: string }) {
  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, components: { none: {} } },
    select: { sku: true, name: true },
    orderBy: { sku: "asc" },
  });
  return (
    <Card title="Lançar movimento manual">
      <p className="mb-3 text-xs text-ink-muted">
        Reservas, saídas de pedidos e transferências são lançadas pelos próprios fluxos. Todo ajuste fica registrado na
        auditoria com usuário, data e motivo.
      </p>
      <MovementForm action={manualMovementAction} products={products} types={MANUAL_TYPES.map((t) => ({ value: t, label: MOVEMENT_LABELS[t] }))} />
    </Card>
  );
}

async function Inventory({ companyId, family }: { companyId: string; family?: string }) {
  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, active: true, components: { none: {} }, ...(family ? { family } : {}) },
    select: { id: true, sku: true, name: true, stockPhysical: true, stockReserved: true },
    orderBy: { sku: "asc" },
  });
  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="aba" value="inventario" />
        <select name="familia" defaultValue={family ?? ""} className={`${inputCls} w-auto`}>
          <option value="">Todas as famílias</option>
          {PRODUCT_FAMILIES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <button className={btnSecondary}>Carregar contagem</button>
      </form>
      {products.length === 0 ? (
        <EmptyState>Nenhum produto nesta família.</EmptyState>
      ) : (
        <InventoryCountForm
          action={inventoryAction}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, physical: p.stockPhysical, reserved: p.stockReserved }))}
        />
      )}
    </div>
  );
}

async function Transfers({ companyId, companies }: { companyId: string; companies: { id: string; code: string; name: string; tradeName: string | null }[] }) {
  const others = companies.filter((c) => c.id !== companyId);
  const [transfers, products] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: { OR: [{ fromCompanyId: companyId }, { toCompanyId: companyId }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { fromCompany: { select: { code: true } }, toCompany: { select: { code: true } } },
    }),
    prisma.product.findMany({
      where: { companyId, deletedAt: null, components: { none: {} } },
      select: { sku: true, name: true },
      orderBy: { sku: "asc" },
    }),
  ]);
  const userIds = [...new Set(transfers.map((t) => t.userId))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });

  return (
    <div className="flex flex-col gap-4">
      <Card title="Nova transferência entre empresas">
        {others.length === 0 ? (
          <p className="text-xs text-ink-muted">Você só tem acesso a uma empresa. Transferências exigem acesso às duas.</p>
        ) : (
          <>
            <datalist id="stock-skus">
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name}
                </option>
              ))}
            </datalist>
            <p className="mb-3 text-xs text-ink-muted">
              Sai desta empresa e entra no produto com o mesmo SKU no destino. O SKU precisa estar cadastrado nas duas.
            </p>
            <TransferForm action={transferAction} companies={others.map((c) => ({ id: c.id, label: `${c.code} · ${c.tradeName || c.name}` }))} />
          </>
        )}
      </Card>
      <Card title="Transferências recentes">
        {transfers.length === 0 ? (
          <p className="text-xs text-ink-muted">Nenhuma transferência.</p>
        ) : (
          <Table
            head={
              <>
                <th className={thCls}>Data</th>
                <th className={thCls}>Direção</th>
                <th className={thCls}>Itens</th>
                <th className={thCls}>Documento</th>
                <th className={thCls}>Responsável</th>
              </>
            }
          >
            {transfers.map((t) => {
              const items = (Array.isArray(t.items) ? t.items : []) as { sku?: string; quantity?: number }[];
              const out = t.fromCompanyId === companyId;
              return (
                <tr key={t.id}>
                  <td className={`${tdCls} whitespace-nowrap`}>{fmtDateTime(t.createdAt)}</td>
                  <td className={tdCls}>
                    <Badge tone={out ? "warning" : "good"}>
                      {out ? "Saída" : "Entrada"} {t.fromCompany.code} → {t.toCompany.code}
                    </Badge>
                  </td>
                  <td className={tdCls}>{items.map((i) => `${i.sku} x ${i.quantity}`).join(", ")}</td>
                  <td className={tdCls}>{t.documentRef ?? "-"}</td>
                  <td className={tdCls}>{users.find((u) => u.id === t.userId)?.name ?? "-"}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
