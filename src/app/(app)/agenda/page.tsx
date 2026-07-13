import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function AgendaPage() {
  await requireView("agenda");

  return (
    <PlaceholderModule
      title="Agenda"
      subtitle='Automação disparada ao mover um negócio para "A caminho"'
      note="A automação de prazo de 3 dias úteis e mensagem pós-venda chega a seguir."
    />
  );
}
