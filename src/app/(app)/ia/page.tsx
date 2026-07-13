import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function IaPage() {
  await requireView("ia");

  return (
    <PlaceholderModule
      title="Inteligência Artificial"
      subtitle="Sugestões, previsões e alertas — sempre com justificativa"
      note="As 7 capacidades de IA chegam na Fase 3, quando a chave da API estiver configurada."
    />
  );
}
