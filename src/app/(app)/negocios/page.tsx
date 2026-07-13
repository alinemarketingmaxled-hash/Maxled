import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function NegociosPage() {
  await requireView("negocios");

  return (
    <PlaceholderModule
      title="Negócios"
      subtitle="Kanban · colunas editáveis, adicionáveis e removíveis"
      note="O quadro Kanban conectado ao banco de dados chega a seguir."
    />
  );
}
