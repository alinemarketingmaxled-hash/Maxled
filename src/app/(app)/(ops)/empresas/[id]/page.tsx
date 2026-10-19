import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/erp/ui";
import { CompanyForm, type CompanyFormValues } from "@/components/erp/empresas/CompanyForm";
import { saveCompanyAction } from "../actions";

const EMPTY: CompanyFormValues = {
  code: "", name: "", tradeName: null, cnpj: null, stateRegistration: null, taxRegime: null, street: null, number: null,
  district: null, city: null, state: null, postalCode: null, phone: null, email: null, description: null, active: true,
  maxDiscountPct: "5", approvalAmountLimit: null, fiscalEnvironment: "HOMOLOGACAO", fiscalProvider: "simulador",
  fiscalSeries: 1, nextFiscalNumber: 1,
};

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("empresas");
  const { id } = await params;
  const editable = canEdit(session.user.role, "empresas");

  let values: CompanyFormValues;
  if (id === "nova") {
    if (!editable) notFound();
    values = EMPTY;
  } else {
    const c = await prisma.company.findUnique({ where: { id } });
    if (!c) notFound();
    values = {
      ...c,
      maxDiscountPct: c.maxDiscountPct.toString(),
      approvalAmountLimit: c.approvalAmountLimit?.toString() ?? null,
    };
  }

  return (
    <div>
      <PageHeader
        title={id === "nova" ? "Nova empresa" : `${values.code} · ${values.tradeName || values.name}`}
        subtitle={<Link href="/empresas" className="hover:text-gold">Voltar para Empresas</Link>}
      />
      <CompanyForm company={values} action={saveCompanyAction} editable={editable} isMediator={session.user.role === "MEDIATOR"} />
    </div>
  );
}
