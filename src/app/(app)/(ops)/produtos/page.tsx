import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { canEdit, canSeeCosts } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { listProducts, PRODUCT_FAMILIES, KIND_LABELS } from "@/lib/erp/products";
import { availabilityFor } from "@/lib/erp/stock";
import { fmtMoney, fmtNumber } from "@/lib/erp/format";
import { PageHeader, Table, thCls, tdCls, Badge, NoCompany, EmptyState, inputCls, btnPrimary, btnSecondary } from "@/components/erp/ui";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; familia?: string; status?: string }>;
}) {
  const session = await requireView("produtos");
  const params = await searchParams;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const companyId = ctx.active.id;
  const products = await listProducts(companyId, { q: params.q, family: params.familia, status: params.status });
  const avail = await availabilityFor(companyId, products.map((p) => p.id));
  const showCosts = canSeeCosts(session.user.role);
  const editable = canEdit(session.user.role, "produtos");

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle={`Catálogo técnico da empresa ${ctx.active.code} · ${products.length} produto(s)`}
        actions={
          editable && (
            <Link href="/produtos/novo" className={btnPrimary}>
              Novo produto
            </Link>
          )
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input name="q" defaultValue={params.q} placeholder="SKU, nome, código de barras ou fabricante" className={inputCls} />
        <select name="familia" defaultValue={params.familia ?? ""} className={inputCls}>
          <option value="">Todas as famílias</option>
          {PRODUCT_FAMILIES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? "ativos"} className={inputCls}>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <button className={btnSecondary}>Filtrar</button>
      </form>

      {products.length === 0 ? (
        <EmptyState>Nenhum produto encontrado.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>SKU</th>
              <th className={thCls}>Nome</th>
              <th className={thCls}>Família</th>
              <th className={thCls}>Tipo</th>
              <th className={`${thCls} text-right`}>Preço</th>
              {showCosts && <th className={`${thCls} text-right`}>Custo</th>}
              {showCosts && <th className={`${thCls} text-right`}>Margem</th>}
              <th className={`${thCls} text-right`}>Disponível</th>
              <th className={thCls}>Situação</th>
            </>
          }
        >
          {products.map((p) => {
            const isKit = p._count.components > 0;
            const available = avail.get(p.id) ?? 0;
            const price = Number(p.price);
            const cost = Number(p.cost);
            const margin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;
            const low = !isKit && p.minStock > 0 && available < p.minStock;
            return (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className={`${tdCls} font-mono text-xs`}>
                  <Link href={`/produtos/${p.id}`} className="text-gold hover:underline">
                    {p.sku}
                  </Link>
                </td>
                <td className={tdCls}>{p.name}</td>
                <td className={tdCls}>{p.family}</td>
                <td className={tdCls}>{isKit ? "Kit" : KIND_LABELS[p.kind]}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(p.price)}</td>
                {showCosts && <td className={`${tdCls} text-right tabular-nums`}>{isKit ? "-" : fmtMoney(p.cost)}</td>}
                {showCosts && (
                  <td className={`${tdCls} text-right tabular-nums`}>{margin === null || isKit ? "-" : `${margin.toFixed(1)}%`}</td>
                )}
                <td className={`${tdCls} text-right tabular-nums`}>{fmtNumber(available)}</td>
                <td className={tdCls}>
                  {!p.active ? (
                    <Badge>Inativo</Badge>
                  ) : low ? (
                    <Badge tone="warning">Abaixo do mínimo</Badge>
                  ) : available <= 0 ? (
                    <Badge tone="critical">Sem saldo</Badge>
                  ) : (
                    <Badge tone="good">OK</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
