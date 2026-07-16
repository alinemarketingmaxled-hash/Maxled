import { prisma } from "@/lib/prisma";
import { listContacts } from "@/lib/contacts";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { assignableOwners } from "@/app/(app)/vendas/actions";
import { NewDealForm } from "@/components/negocios/NewDealForm";

export default async function NovoNegocioPage() {
  const session = await requireView("negocios");
  if (!canEdit(session.user.role, "negocios")) redirect("/negocios");

  const [contacts, owners, pipeline] = await Promise.all([
    listContacts(session),
    assignableOwners(session),
    prisma.pipeline.findFirst({
      where: { isDefault: true },
      include: { stages: { orderBy: { order: "asc" } } },
    }),
  ]);

  if (!pipeline || contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gold-deep/40 bg-surface px-6 py-10 text-center text-sm text-ink-muted">
        {contacts.length === 0
          ? "Cadastre um contato em Clientes antes de criar um negócio."
          : "Nenhum pipeline configurado."}
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h2 className="mb-4 font-display text-[22px] text-ink">Novo negócio</h2>
      <NewDealForm
        contacts={contacts.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          accountName: c.accountName,
          phone: c.phone,
          mobile: c.mobile,
          cnpj: c.cnpj,
        }))}
        owners={owners}
        stages={pipeline.stages}
        defaultOwnerId={session.user.id}
        cancelHref="/negocios"
      />
    </div>
  );
}
