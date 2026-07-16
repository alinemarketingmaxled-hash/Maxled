import { redirect, notFound } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getVendor } from "@/lib/users";
import { VendorForm } from "@/components/perfil/VendorForm";
import { BackLink } from "@/components/shell/BackLink";
import { updateVendorAction, deactivateVendorAction, unlockVendorAction } from "../actions";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireView("perfil");
  if (!canEdit(session.user.role, "perfil")) redirect("/perfil");

  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) notFound();

  return (
    <div className="max-w-xl">
      <BackLink href="/perfil" label="Voltar" />
      <h2 className="mb-4 font-display text-[22px] text-ink">Editar {vendor.name}</h2>

      {vendor.lockedAt && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3">
          <span className="text-sm text-critical">
            Acesso bloqueado após {vendor.failedLoginAttempts} tentativas de login incorretas.
          </span>
          <form action={unlockVendorAction.bind(null, vendor.id)}>
            <button
              type="submit"
              className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical transition-colors hover:bg-critical/10"
            >
              Desbloquear acesso
            </button>
          </form>
        </div>
      )}

      <VendorForm vendor={vendor} action={updateVendorAction.bind(null, vendor.id)} />

      {vendor.id !== session.user.id && (
        <form action={deactivateVendorAction.bind(null, vendor.id)} className="mt-4">
          <button
            type="submit"
            className="rounded-lg border border-critical/50 px-3.5 py-1.5 text-xs font-semibold text-critical hover:border-critical"
          >
            Desativar vendedor
          </button>
        </form>
      )}
    </div>
  );
}
