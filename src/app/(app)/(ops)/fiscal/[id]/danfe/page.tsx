import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireView } from "@/lib/require-permission";
import { getCompanyContext } from "@/lib/erp/company";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/erp/format";
import { formatAccessKey } from "@/components/erp/fiscal/FiscalStatusBadge";
import { PrintButton } from "@/components/erp/fiscal/PrintButton";
import { NoCompany } from "@/components/erp/ui";

const box = "border border-black/70 px-2 py-1";
const lbl = "block text-[8.5px] uppercase tracking-wide text-black/60";

/** DANFE simplificado para conferência/impressão. O DANFE oficial é gerado
 * pelo provedor fiscal real; este é montado a partir dos dados gravados. */
export default async function DanfePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireView("fiscal");
  const { id } = await params;
  let ctx;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const doc = await prisma.fiscalDocument.findFirst({
    where: { id, companyId: ctx.active.id, status: { in: ["AUTORIZADA", "CANCELADA"] } },
    include: {
      company: true,
      order: {
        include: {
          contact: true,
          items: { orderBy: { position: "asc" }, include: { product: { select: { sku: true, name: true, ncm: true, unit: true } } } },
        },
      },
    },
  });
  if (!doc) notFound();
  const { company: e, order } = doc;
  const d = order.contact;
  const homolog = doc.environment === "HOMOLOGACAO";

  return (
    <div className="mx-auto max-w-[900px]">
      <style>{`@media print { aside, header, .no-print { display: none !important; } main, .ops-light { padding: 0 !important; margin: 0 !important; background: #fff !important; } }`}</style>
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <a href={`/fiscal/${doc.id}`} className="text-xs text-gold underline">
          Voltar para a nota
        </a>
        <PrintButton />
      </div>

      <div className="relative overflow-hidden bg-white p-4 text-[11px] text-black shadow-sm">
        {(homolog || doc.status === "CANCELADA") && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-4xl font-bold uppercase text-black/10 sm:text-6xl"
            style={{ transform: "rotate(-24deg)" }}
          >
            {doc.status === "CANCELADA" ? "Cancelada" : "Sem valor fiscal"}
          </div>
        )}
        {homolog && (
          <p className="mb-2 border border-black/70 py-1 text-center font-bold">
            NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_0.8fr_1.4fr]">
          <div className={box}>
            <p className="text-sm font-bold">{e.name}</p>
            <p>
              {[e.street, e.number, e.district].filter(Boolean).join(", ")} {e.city ? `- ${e.city}/${e.state ?? ""}` : ""}
            </p>
            <p>CEP {e.postalCode ?? "-"} · {e.phone ?? ""}</p>
          </div>
          <div className={`${box} text-center`}>
            <p className="text-base font-bold">DANFE</p>
            <p>Documento auxiliar da nota fiscal eletrônica</p>
            <p className="mt-1">1 - Saída</p>
            <p className="font-bold">
              Nº {String(doc.number ?? 0).padStart(9, "0")} · Série {doc.series}
            </p>
          </div>
          <div className={box}>
            <span className={lbl}>Chave de acesso</span>
            <p className="font-mono text-[10.5px]">{formatAccessKey(doc.accessKey)}</p>
            <span className={`${lbl} mt-1`}>Protocolo de autorização</span>
            <p>
              {doc.protocol ?? "-"} · {fmtDateTime(doc.authorizedAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4">
          <div className={`${box} col-span-2`}>
            <span className={lbl}>Natureza da operação</span>Venda de mercadoria
          </div>
          <div className={box}>
            <span className={lbl}>Inscrição estadual</span>
            {e.stateRegistration ?? "-"}
          </div>
          <div className={box}>
            <span className={lbl}>CNPJ</span>
            {e.cnpj ?? "-"}
          </div>
        </div>

        <p className="mt-2 font-bold">DESTINATÁRIO / REMETENTE</p>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <div className={`${box} col-span-2`}>
            <span className={lbl}>Nome / razão social</span>
            {d.accountName || `${d.firstName} ${d.lastName}`}
          </div>
          <div className={box}>
            <span className={lbl}>CNPJ / CPF</span>
            {d.cnpj ?? "-"}
          </div>
          <div className={box}>
            <span className={lbl}>Data de emissão</span>
            {fmtDate(doc.authorizedAt ?? doc.createdAt)}
          </div>
          <div className={`${box} col-span-2`}>
            <span className={lbl}>Endereço</span>
            {[d.street, d.number].filter(Boolean).join(", ") || "-"}
          </div>
          <div className={box}>
            <span className={lbl}>Município / UF</span>
            {d.city ?? "-"}/{d.state ?? "-"}
          </div>
          <div className={box}>
            <span className={lbl}>CEP / IE</span>
            {d.postalCode ?? "-"} / {d.inscricaoEstadual ?? "-"}
          </div>
        </div>

        <p className="mt-2 font-bold">CÁLCULO DO IMPOSTO</p>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <div className={box}>
            <span className={lbl}>Valor dos produtos</span>
            {fmtMoney(order.itemsTotal)}
          </div>
          <div className={box}>
            <span className={lbl}>Frete</span>
            {fmtMoney(order.freight)}
          </div>
          <div className={box}>
            <span className={lbl}>Desconto</span>
            {fmtMoney(order.discountTotal)}
          </div>
          <div className={box}>
            <span className={lbl}>Valor total da nota</span>
            <b>{fmtMoney(doc.totalAmount)}</b>
          </div>
        </div>

        <p className="mt-2 font-bold">TRANSPORTADOR / VOLUMES</p>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <div className={`${box} col-span-2`}>
            <span className={lbl}>Transportadora</span>
            {order.carrier ?? "-"}
          </div>
          <div className={box}>
            <span className={lbl}>Frete por conta</span>
            {order.freightPayer ?? "-"}
          </div>
          <div className={box}>
            <span className={lbl}>Volumes / peso bruto</span>
            {order.packages ?? "-"} / {order.grossWeightKg ? `${order.grossWeightKg.toString()} kg` : "-"}
          </div>
        </div>

        <p className="mt-2 font-bold">DADOS DOS PRODUTOS</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                {["Código", "Descrição", "NCM", "Un.", "Qtd.", "V. unit.", "V. total"].map((h) => (
                  <th key={h} className="border border-black/70 px-1.5 py-1 text-left text-[9px] uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td className="border border-black/70 px-1.5 py-0.5">{i.product.sku}</td>
                  <td className="border border-black/70 px-1.5 py-0.5">{i.product.name}</td>
                  <td className="border border-black/70 px-1.5 py-0.5">{i.product.ncm}</td>
                  <td className="border border-black/70 px-1.5 py-0.5">{i.product.unit}</td>
                  <td className="border border-black/70 px-1.5 py-0.5 text-right tabular-nums">{i.quantity}</td>
                  <td className="border border-black/70 px-1.5 py-0.5 text-right tabular-nums">{fmtMoney(i.unitPrice)}</td>
                  <td className="border border-black/70 px-1.5 py-0.5 text-right tabular-nums">{fmtMoney(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${box} mt-2`}>
          <span className={lbl}>Informações complementares</span>
          {homolog ? "Documento de homologação, sem valor fiscal. " : ""}
          Tributos calculados pelo provedor fiscal. {order.notes ?? ""}
        </div>
      </div>
    </div>
  );
}
