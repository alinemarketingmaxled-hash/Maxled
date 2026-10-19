import { requireView } from "@/lib/require-permission";
import { canEdit, canEditCosts, canEditPrices, canSeeCosts } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getCompanyContext } from "@/lib/erp/company";
import { productFormOptions } from "@/lib/erp/products";
import { PageHeader, NoCompany } from "@/components/erp/ui";
import { ProductForm } from "@/components/erp/produtos/ProductForm";
import { BackLink } from "@/components/shell/BackLink";
import { saveProductAction } from "../actions";

export default async function NovoProdutoPage() {
  const session = await requireView("produtos");
  if (!canEdit(session.user.role, "produtos")) redirect("/produtos");
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const options = await productFormOptions(ctx.active.id);
  const role = session.user.role;

  return (
    <div>
      <BackLink href="/produtos" label="Produtos" />
      <PageHeader title="Novo produto" subtitle={`Empresa ${ctx.active.code}`} />
      <ProductForm
        action={saveProductAction}
        {...options}
        canEditPrices={canEditPrices(role)}
        canEditCosts={canEditCosts(role)}
        canSeeCosts={canSeeCosts(role)}
        values={{
          sku: "", barcode: "", manufacturerCode: "", name: "", description: "", technicalSpecs: "",
          family: "Outros", category: "", brand: "", unit: "UN", kind: "UNIDADE", packQty: 1,
          ncm: "", cest: "", origin: 0, price: "", minPrice: "", cost: "", minStock: 0, reorderQty: "",
          weightKg: "", lengthCm: "", widthCm: "", heightCm: "", imageUrl: "", datasheetUrl: "", active: true,
          kit: [], suppliers: [],
        }}
      />
    </div>
  );
}
