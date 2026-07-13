import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function PerfilPage() {
  await requireView("perfil");

  return (
    <PlaceholderModule
      title="Perfil — Mediador"
      subtitle="Acesso total a todos os perfis · cadastro de vendedores"
      note="Cadastro de vendedores, metas e comissão chegam a seguir."
    />
  );
}
