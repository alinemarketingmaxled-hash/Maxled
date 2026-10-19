import { requireView } from "@/lib/require-permission";
import { getPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveReportContext } from "@/lib/erp/report-context";
import { runReport, type ColKind } from "@/lib/erp/reports";
import { CHANNEL_LABELS, ORDER_STATUS_LABELS } from "@/lib/erp/orders";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/erp/format";
import { Card, EmptyState, Field, Kpi, NoCompany, PageHeader, Tabs, btnPrimary, btnSecondary, inputCls, tdCls, thCls } from "@/components/erp/ui";
import { DownloadIcon } from "@/components/shared/Icons";

function fmt(v: string | number | null, kind: ColKind) {
  if (v === null || v === undefined || v === "") return "-";
  if (kind === "money") return fmtMoney(Number(v));
  if (kind === "int") return fmtNumber(Number(v));
  if (kind === "pct") return `${Number(v).toFixed(1).replace(".", ",")}%`;
  if (kind === "date") return fmtDate(String(v));
  return String(v);
}

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireView("relatorios");
  const sp = await searchParams;

  let ctx;
  try {
    ctx = await resolveReportContext(session, sp);
  } catch {
    return (
      <div>
        <PageHeader title="Relatórios" />
        <NoCompany />
      </div>
    );
  }
  const { tabs, tab, filters, companyIds, consolidated, canConsolidate } = ctx;
  if (!tab) {
    return (
      <div>
        <PageHeader title="Relatórios" />
        <EmptyState>Nenhum relatório disponível para o seu perfil.</EmptyState>
      </div>
    );
  }

  const ownOnly =
    getPermission(session.user.role, "relatorios").scope === "own" || getPermission(session.user.role, "pedidos").scope === "own";

  const [result, sellers, contacts, families, products] = await Promise.all([
    runReport(session, tab, companyIds, filters, ctx.companyLabel),
    ownOnly
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { deletedAt: null, salesOrders: { some: { companyId: { in: companyIds } } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
    prisma.contact.findMany({
      where: {
        deletedAt: null,
        salesOrders: { some: { companyId: { in: companyIds }, ...(ownOnly ? { sellerId: session.user.id } : {}) } },
      },
      orderBy: [{ accountName: "asc" }, { firstName: "asc" }],
      take: 500,
      select: { id: true, firstName: true, lastName: true, accountName: true },
    }),
    prisma.product.findMany({
      where: { companyId: { in: companyIds }, deletedAt: null },
      distinct: ["family"],
      orderBy: { family: "asc" },
      select: { family: true },
    }),
    prisma.product.findMany({
      where: { companyId: { in: companyIds }, deletedAt: null, ...(filters.family ? { family: filters.family } : {}) },
      orderBy: { sku: "asc" },
      take: 500,
      select: { id: true, sku: true, name: true },
    }),
  ]);

  const baseQuery = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) q.set(k, v);
    return q.toString();
  };

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle={consolidated ? "Consolidado: todas as suas empresas" : `${ctx.ctx.active.code} · ${ctx.ctx.active.tradeName || ctx.ctx.active.name}`}
        actions={
          <a href={`/api/erp/relatorios/export?${baseQuery({ aba: tab })}`} className={btnSecondary}>
            <DownloadIcon className="h-3.5 w-3.5" /> Exportar CSV
          </a>
        }
      />

      <Card className="mb-4">
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <input type="hidden" name="aba" value={tab} />
          {canConsolidate && (
            <Field label="Empresa">
              <select name="empresa" defaultValue={consolidated ? "todas" : ""} className={inputCls}>
                <option value="">Empresa ativa</option>
                <option value="todas">Consolidado</option>
              </select>
            </Field>
          )}
          <Field label="De">
            <input type="date" name="de" defaultValue={filters.fromStr} className={inputCls} />
          </Field>
          <Field label="Até">
            <input type="date" name="ate" defaultValue={filters.toStr} className={inputCls} />
          </Field>
          {!ownOnly && (
            <Field label="Vendedor">
              <select name="vendedor" defaultValue={filters.sellerId ?? ""} className={inputCls}>
                <option value="">Todos</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Cliente">
            <select name="cliente" defaultValue={filters.contactId ?? ""} className={inputCls}>
              <option value="">Todos</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.accountName || `${c.firstName} ${c.lastName}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Família">
            <select name="familia" defaultValue={filters.family ?? ""} className={inputCls}>
              <option value="">Todas</option>
              {families.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.family}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Produto">
            <select name="produto" defaultValue={filters.productId ?? ""} className={inputCls}>
              <option value="">Todos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Canal">
            <select name="canal" defaultValue={filters.channel ?? ""} className={inputCls}>
              <option value="">Todos</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status do pedido">
            <select name="status" defaultValue={filters.status ?? ""} className={inputCls}>
              <option value="">Vendidos (aprovado em diante)</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="submit" className={`${btnPrimary} w-full`}>
              Aplicar filtros
            </button>
          </div>
        </form>
      </Card>

      <Tabs
        active={tab}
        tabs={tabs.map((t) => ({ key: t.key, label: t.label, href: `/relatorios?${baseQuery({ aba: t.key })}` }))}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {result.kpis.map((k) => (
          <Kpi key={k.label} label={k.label} value={fmt(k.value, k.kind)} hint={k.hint} />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {result.tables.map((t) => (
          <div key={t.title}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">{t.title}</h3>
            {t.rows.length === 0 ? (
              <EmptyState>Sem dados no período/filtros selecionados.</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gold-deep/25 bg-surface">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr>
                      {t.headers.map((h, i) => (
                        <th key={h} className={`${thCls} ${t.kinds[i] !== "text" && t.kinds[i] !== "date" ? "text-right" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((v, i) => (
                          <td
                            key={i}
                            className={`${tdCls} ${t.kinds[i] !== "text" && t.kinds[i] !== "date" ? "text-right tabular-nums" : ""}`}
                          >
                            {fmt(v, t.kinds[i])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {t.note && <p className="mt-1 text-[11px] text-ink-faint">{t.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
