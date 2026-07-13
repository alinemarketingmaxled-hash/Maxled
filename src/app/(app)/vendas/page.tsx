import { PlaceholderModule } from "@/components/shell/PlaceholderModule";
import { requireView } from "@/lib/require-permission";

export default async function VendasPage() {
  await requireView("vendas");

  return (
    <PlaceholderModule
      title="Vendas"
      subtitle="Cadastro completo de clientes · histórico de negócios vinculado"
      note="Lista de contatos, ficha completa e exportação chegam a seguir."
    />
  );
}
