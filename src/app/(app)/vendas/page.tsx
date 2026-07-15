import Link from "next/link";
import { canEdit } from "@/lib/permissions";
import { listContacts, getContact } from "@/lib/contacts";
import { requireView } from "@/lib/require-permission";
import { ContactListPanel } from "@/components/vendas/ContactListPanel";
import { ContactDetailPanel } from "@/components/vendas/ContactDetailPanel";
import { ContactForm } from "@/components/vendas/ContactForm";
import { ImportExportBar } from "@/components/vendas/ImportExportBar";
import { createContactAction, updateContactAction, assignableOwners } from "./actions";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; edit?: string; new?: string; imported?: string }>;
}) {
  const session = await requireView("vendas");
  const params = await searchParams;
  const editable = canEdit(session.user.role, "vendas");

  const contacts = await listContacts(session);
  const selectedId = params.id ?? contacts[0]?.id;
  const selected = selectedId ? await getContact(session, selectedId) : null;
  const owners = await assignableOwners(session);

  const isNew = params.new === "1" && editable;
  const isEditing = params.edit === "1" && editable && selected;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] text-ink">Clientes</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Cadastro completo de clientes · histórico de negócios vinculado
          </p>
        </div>
        {editable && (
          <Link
            href="/vendas?new=1"
            className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            ＋ Novo contato
          </Link>
        )}
      </div>

      <ImportExportBar canEdit={editable} importSummary={params.imported} />

      <div className="grid grid-cols-[280px_1fr] gap-4">
        <ContactListPanel contacts={contacts} selectedId={selectedId} />

        {isNew && (
          <div className="rounded-xl border border-gold-deep/30 bg-surface p-5">
            <h3 className="mb-4 font-display text-lg text-ink">Novo contato</h3>
            <ContactForm owners={owners} action={createContactAction} />
          </div>
        )}

        {!isNew && isEditing && selected && (
          <div className="rounded-xl border border-gold-deep/30 bg-surface p-5">
            <h3 className="mb-4 font-display text-lg text-ink">
              Editar {selected.firstName} {selected.lastName}
            </h3>
            <ContactForm
              contact={selected}
              owners={owners}
              action={updateContactAction.bind(null, selected.id)}
            />
          </div>
        )}

        {!isNew && !isEditing && selected && (
          <ContactDetailPanel contact={selected} canEdit={editable} />
        )}

        {!isNew && !selected && (
          <div className="rounded-xl border border-dashed border-gold-deep/40 bg-surface px-6 py-10 text-center text-sm text-ink-muted">
            Nenhum contato cadastrado ainda.
          </div>
        )}
      </div>
    </div>
  );
}
