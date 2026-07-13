import { redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { VendorForm } from "@/components/perfil/VendorForm";
import { createVendorAction } from "../actions";

export default async function NovoVendedorPage() {
  const session = await requireView("perfil");
  if (!canEdit(session.user.role, "perfil")) redirect("/perfil");

  return (
    <div className="max-w-xl">
      <h2 className="mb-4 font-display text-[22px] text-ink">Novo vendedor</h2>
      <VendorForm action={createVendorAction} />
    </div>
  );
}
