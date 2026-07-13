import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function ConfigPage() {
  await requireView("config");

  return (
    <PlaceholderModule
      title="Config"
      subtitle="Permissões por módulo, logs de atividade e preferências"
      note="A matriz de permissões editável chega na Fase 2."
    />
  );
}
