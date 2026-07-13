import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function SocialPage() {
  await requireView("social");

  return (
    <PlaceholderModule
      title="Rede Social Interna"
      subtitle="Feed da equipe · todos podem postar, curtir e comentar"
      note="O feed chega na Fase 2, junto com a gamificação."
    />
  );
}
