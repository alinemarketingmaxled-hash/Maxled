import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function AnaliticaPage() {
  const session = await requireView("analitica");

  return (
    <PlaceholderModule
      title="Analítica"
      subtitle={`Olá, ${session.user.name ?? session.user.email} — login e permissões já funcionando.`}
      note="Os widgets de KPI, Gráfico, Funil e Medidor de meta entram aqui a seguir, ligados a dados reais."
    />
  );
}
