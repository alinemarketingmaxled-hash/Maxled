import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { canEdit, ROLE_LABELS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Table, btnPrimary, tdCls, thCls } from "@/components/erp/ui";
import { AccessRow } from "@/components/erp/empresas/AccessRow";
import { setUserCompaniesAction } from "./actions";

export default async function EmpresasPage() {
  const session = await requireView("empresas");
  const editable = canEdit(session.user.role, "empresas");

  const [companies, users] = await Promise.all([
    prisma.company.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { users: true, salesOrders: true, products: true } } },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, companies: { select: { companyId: true } } },
    }),
  ]);
  const withoutCompany = users.filter((u) => u.role !== "MEDIATOR" && u.companies.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Empresas"
        subtitle="Cada empresa tem cadastros, estoque, documentos fiscais, contas e relatórios próprios."
        actions={
          editable && (
            <Link href="/empresas/nova" className={btnPrimary}>
              Nova empresa
            </Link>
          )
        }
      />

      <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
        Regime tributário e dados fiscais devem ser confirmados com a contabilidade antes da homologação.
      </p>

      <Table
        head={
          <>
            <th className={thCls}>Código</th>
            <th className={thCls}>Empresa</th>
            <th className={thCls}>CNPJ</th>
            <th className={thCls}>Regime</th>
            <th className={thCls}>Fiscal</th>
            <th className={`${thCls} text-right`}>Usuários</th>
            <th className={`${thCls} text-right`}>Produtos</th>
            <th className={`${thCls} text-right`}>Pedidos</th>
            <th className={thCls}>Situação</th>
          </>
        }
      >
        {companies.map((c) => (
          <tr key={c.id}>
            <td className={`${tdCls} font-semibold`}>
              <Link href={`/empresas/${c.id}`} className="text-gold hover:text-gold-bright">
                {c.code}
              </Link>
            </td>
            <td className={tdCls}>
              <Link href={`/empresas/${c.id}`} className="hover:text-gold">
                {c.tradeName || c.name}
              </Link>
              {c.description && <div className="text-[11.5px] text-ink-faint">{c.description}</div>}
            </td>
            <td className={`${tdCls} tabular-nums`}>{c.cnpj || <span className="text-warning">Pendente</span>}</td>
            <td className={tdCls}>{c.taxRegime || <span className="text-warning">A confirmar</span>}</td>
            <td className={tdCls}>
              <Badge tone={c.fiscalEnvironment === "PRODUCAO" ? "good" : "info"}>
                {c.fiscalEnvironment === "PRODUCAO" ? "Produção" : "Homologação"}
              </Badge>
              <div className="mt-0.5 text-[11.5px] text-ink-faint">
                {c.fiscalProvider} · série {c.fiscalSeries} · próx. {c.nextFiscalNumber}
              </div>
            </td>
            <td className={`${tdCls} text-right tabular-nums`}>{c._count.users}</td>
            <td className={`${tdCls} text-right tabular-nums`}>{c._count.products}</td>
            <td className={`${tdCls} text-right tabular-nums`}>{c._count.salesOrders}</td>
            <td className={tdCls}>
              <Badge tone={c.active ? "good" : "neutral"}>{c.active ? "Ativa" : "Inativa"}</Badge>
            </td>
          </tr>
        ))}
      </Table>

      <Card title="Acesso dos usuários às empresas">
        {withoutCompany.length > 0 && (
          <p className="mb-2 text-xs text-critical">
            {withoutCompany.length} usuário(s) sem empresa vinculada não conseguem usar o ERP: {withoutCompany.map((u) => u.name).join(", ")}.
          </p>
        )}
        <p className="mb-2 text-xs text-ink-muted">
          Perfis e senhas são gerenciados em Perfil. Aqui define-se apenas quais empresas cada usuário opera.
        </p>
        <ul>
          {users.map((u) => (
            <AccessRow
              key={u.id}
              user={{
                id: u.id,
                name: u.name,
                email: u.email,
                roleLabel: ROLE_LABELS[u.role],
                companyIds: u.companies.map((c) => c.companyId),
                isMediator: u.role === "MEDIATOR",
              }}
              companies={companies.map((c) => ({ id: c.id, code: c.code, name: c.tradeName || c.name }))}
              action={setUserCompaniesAction}
              editable={editable}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}
