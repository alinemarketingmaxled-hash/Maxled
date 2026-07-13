import type { Contact } from "@/generated/prisma/client";

type Owner = { id: string; name: string };

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-ink-faint">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        step={type === "number" ? "any" : undefined}
        className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
      />
    </label>
  );
}

export function ContactForm({
  contact,
  owners,
  action,
}: {
  contact?: Contact | null;
  owners: Owner[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const showOwnerPicker = owners.length > 1;

  return (
    <form action={action} className="flex flex-col gap-6">
      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Identificação
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {showOwnerPicker ? (
            <label className="col-span-2 flex flex-col gap-1 text-xs">
              <span className="text-ink-faint">Proprietário do contato</span>
              <select
                name="ownerId"
                defaultValue={contact?.ownerId ?? owners[0]?.id}
                className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="ownerId" value={owners[0]?.id} />
          )}
          <Field label="Nome" name="firstName" defaultValue={contact?.firstName} />
          <Field label="Sobrenome" name="lastName" defaultValue={contact?.lastName} />
          <Field label="Conta / Empresa" name="accountName" defaultValue={contact?.accountName} />
          <Field label="Título" name="jobTitle" defaultValue={contact?.jobTitle} />
          <Field label="Departamento" name="department" defaultValue={contact?.department} />
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Contato
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail" name="email" type="email" defaultValue={contact?.email} />
          <Field label="Celular" name="mobile" defaultValue={contact?.mobile} />
          <Field label="Telefone" name="phone" defaultValue={contact?.phone} />
          <Field label="Telefone residencial" name="residentialPhone" defaultValue={contact?.residentialPhone} />
          <Field label="Telefone do assistente" name="assistantPhone" defaultValue={contact?.assistantPhone} />
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Origem
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fonte de cliente potencial" name="leadSource" defaultValue={contact?.leadSource} />
          <Field label="Nome fornecedor" name="supplierName" defaultValue={contact?.supplierName} />
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Endereço
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rua" name="street" defaultValue={contact?.street} />
          <Field label="Número" name="number" defaultValue={contact?.number} />
          <Field label="Cidade" name="city" defaultValue={contact?.city} />
          <Field label="Estado" name="state" defaultValue={contact?.state} />
          <Field label="CEP" name="postalCode" defaultValue={contact?.postalCode} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude" name="latitude" type="number" defaultValue={contact?.latitude} />
            <Field label="Longitude" name="longitude" type="number" defaultValue={contact?.longitude} />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-bright"
        >
          {contact ? "Salvar alterações" : "Criar contato"}
        </button>
      </div>
    </form>
  );
}
