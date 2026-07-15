import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listContacts } from "@/lib/contacts";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { assignableOwners } from "@/app/(app)/vendas/actions";
import { createDealAction } from "../actions";

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
      <form action={createDealAction} className="flex flex-col gap-4 rounded-xl border border-gold-deep/30 bg-surface p-5">
        {owners.length > 1 ? (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Proprietário</span>
            <select
              name="ownerId"
              defaultValue={session.user.id}
              className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="ownerId" value={session.user.id} />
        )}

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Contato</span>
          <select
            name="contactId"
            required
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} {c.accountName ? `— ${c.accountName}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Nome do negócio</span>
          <input
            name="name"
            required
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Valor (R$)</span>
          <input
            name="value"
            type="number"
            step="0.01"
            min="0"
            required
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Estágio inicial</span>
          <select
            name="stageId"
            defaultValue={pipeline.stages[0]?.id}
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
          >
            {pipeline.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <Link
            href="/negocios"
            className="rounded-lg border border-gold-deep px-4 py-2 text-xs font-semibold text-ink"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            Criar negócio
          </button>
        </div>
      </form>
    </div>
  );
}
