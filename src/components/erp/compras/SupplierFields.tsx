import { Field, inputCls } from "@/components/erp/ui";

export type SupplierValues = {
  name?: string; tradeName?: string | null; document?: string | null; country?: string; currency?: string;
  email?: string | null; phone?: string | null; contactName?: string | null; address?: string | null;
  paymentTerms?: string | null; leadTimeDays?: number | null; rating?: number | null; notes?: string | null;
};

export function SupplierFields({ s = {}, disabled = false }: { s?: SupplierValues; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Razão social / nome *"><input name="name" required defaultValue={s.name} disabled={disabled} className={inputCls} /></Field>
      <Field label="Nome fantasia"><input name="tradeName" defaultValue={s.tradeName ?? ""} disabled={disabled} className={inputCls} /></Field>
      <Field label="CNPJ / Tax ID"><input name="document" defaultValue={s.document ?? ""} disabled={disabled} className={inputCls} /></Field>
      <Field label="País"><input name="country" defaultValue={s.country ?? "Brasil"} disabled={disabled} className={inputCls} /></Field>
      <Field label="Moeda (BRL, USD, CNY...)"><input name="currency" maxLength={3} defaultValue={s.currency ?? "BRL"} disabled={disabled} className={inputCls} /></Field>
      <Field label="Contato"><input name="contactName" defaultValue={s.contactName ?? ""} disabled={disabled} className={inputCls} /></Field>
      <Field label="E-mail"><input name="email" type="email" defaultValue={s.email ?? ""} disabled={disabled} className={inputCls} /></Field>
      <Field label="Telefone"><input name="phone" defaultValue={s.phone ?? ""} disabled={disabled} className={inputCls} /></Field>
      <Field label="Condições de pagamento"><input name="paymentTerms" defaultValue={s.paymentTerms ?? ""} disabled={disabled} placeholder="Ex.: 30/60 dias, 30% antecipado" className={inputCls} /></Field>
      <Field label="Prazo de entrega (dias)"><input name="leadTimeDays" type="number" min={0} defaultValue={s.leadTimeDays ?? ""} disabled={disabled} className={inputCls} /></Field>
      <Field label="Avaliação (1 a 5)">
        <select name="rating" defaultValue={s.rating ?? ""} disabled={disabled} className={inputCls}>
          <option value="">Sem avaliação</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <Field label="Endereço" className="sm:col-span-2 lg:col-span-3"><textarea name="address" rows={2} defaultValue={s.address ?? ""} disabled={disabled} className={inputCls} /></Field>
      <Field label="Observações / documentos" className="sm:col-span-2 lg:col-span-3"><textarea name="notes" rows={3} defaultValue={s.notes ?? ""} disabled={disabled} className={inputCls} /></Field>
    </div>
  );
}
