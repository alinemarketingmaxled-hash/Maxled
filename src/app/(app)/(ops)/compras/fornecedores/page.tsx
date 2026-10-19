import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/erp/company";
import { prisma } from "@/lib/prisma";
import { PageHeader, Table, thCls, tdCls, EmptyState, NoCompany, btnPrimary, btnSecondary, inputCls } from "@/components/erp/ui";

export default async function FornecedoresPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireView("compras");
  let companyId: string;
  try {
    companyId = (await getCompanyContext(session)).active.id;
  } catch {
    return <NoCompany />;
  }
  const { q } = await searchParams;
  const suppliers = await prisma.supplier.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { tradeName: { contains: q, mode: "insensitive" } }, { document: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { purchaseOrders: true, products: true } } },
  });
  const editable = canEdit(session.user.role, "compras");

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro de fornecedores nacionais e estrangeiros da empresa ativa."
        actions={
          <>
            <Link href="/compras" className={btnSecondary}>Compras</Link>
            {editable && <Link href="/compras/fornecedores/novo" className={btnPrimary}>Novo fornecedor</Link>}
          </>
        }
      />
      <form className="mb-3 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou documento" className={`${inputCls} max-w-sm`} />
        <button className={btnSecondary}>Buscar</button>
      </form>
      {suppliers.length === 0 ? (
        <EmptyState>Nenhum fornecedor encontrado.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <th className={thCls}>Fornecedor</th>
              <th className={thCls}>Documento</th>
              <th className={thCls}>País / moeda</th>
              <th className={thCls}>Prazo</th>
              <th className={thCls}>Avaliação</th>
              <th className={thCls}>Compras</th>
              <th className={thCls}>Produtos</th>
            </>
          }
        >
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td className={tdCls}>
                <Link href={`/compras/fornecedores/${s.id}`} className="font-semibold text-gold hover:underline">{s.name}</Link>
                {s.tradeName && <div className="text-[11px] text-ink-faint">{s.tradeName}</div>}
              </td>
              <td className={tdCls}>{s.document ?? "-"}</td>
              <td className={tdCls}>{s.country} · {s.currency}</td>
              <td className={tdCls}>{s.leadTimeDays !== null ? `${s.leadTimeDays} dias` : "-"}</td>
              <td className={tdCls}>{s.rating ? `${s.rating}/5` : "-"}</td>
              <td className={`${tdCls} tabular-nums`}>{s._count.purchaseOrders}</td>
              <td className={`${tdCls} tabular-nums`}>{s._count.products}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
