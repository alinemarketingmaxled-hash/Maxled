"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Contact } from "@/generated/prisma/client";
import { lookupCnpjAction } from "@/app/(app)/vendas/actions";

type Owner = { id: string; name: string };

function Field({
  label,
  name,
  defaultValue,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
}) {
  const controlled = value !== undefined;
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-ink-faint">{label}</span>
      <input
        name={name}
        type={type}
        {...(controlled
          ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
        step={type === "number" ? "any" : undefined}
        className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
      />
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-ink-faint">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
  const cancelHref = contact ? `/vendas?id=${contact.id}` : "/vendas";
  const showOwnerPicker = owners.length > 1;

  const [cnpj, setCnpj] = useState(contact?.cnpj ?? "");
  const [accountName, setAccountName] = useState(contact?.accountName ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [street, setStreet] = useState(contact?.street ?? "");
  const [number, setNumber] = useState(contact?.number ?? "");
  const [city, setCity] = useState(contact?.city ?? "");
  const [state, setState] = useState(contact?.state ?? "");
  const [postalCode, setPostalCode] = useState(contact?.postalCode ?? "");
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [isLookingUp, startLookup] = useTransition();

  function handleLookupCnpj() {
    setCnpjError(null);
    startLookup(async () => {
      const result = await lookupCnpjAction(cnpj);
      if (!result) {
        setCnpjError("CNPJ não encontrado. Confira o número ou preencha manualmente.");
        return;
      }
      if (result.accountName) setAccountName(result.accountName);
      if (result.phone) setPhone(result.phone);
      if (result.street) setStreet(result.street);
      if (result.number) setNumber(result.number);
      if (result.city) setCity(result.city);
      if (result.state) setState(result.state);
      if (result.postalCode) setPostalCode(result.postalCode);
    });
  }

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
          <Select
            label="Tipo de pessoa"
            name="personType"
            defaultValue={contact?.personType}
            options={[
              { value: "FISICA", label: "Física" },
              { value: "JURIDICA", label: "Jurídica" },
            ]}
          />
          <Field label="Nome" name="firstName" defaultValue={contact?.firstName} />
          <Field label="Sobrenome" name="lastName" defaultValue={contact?.lastName} />
          <div className="col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <Field label="CNPJ" name="cnpj" value={cnpj} onChange={setCnpj} />
            </div>
            <button
              type="button"
              onClick={handleLookupCnpj}
              disabled={!cnpj.replace(/\D/g, "") || isLookingUp}
              className="mb-[1px] shrink-0 rounded-md border border-gold-deep px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLookingUp ? "Buscando…" : "Buscar CNPJ"}
            </button>
          </div>
          {cnpjError && <p className="col-span-2 -mt-2 text-[11px] text-critical">{cnpjError}</p>}
          <Field label="Conta / Empresa" name="accountName" value={accountName} onChange={setAccountName} />
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
          <Field label="Celular / WhatsApp" name="mobile" defaultValue={contact?.mobile} />
          <Field label="Telefone" name="phone" value={phone} onChange={setPhone} />
          <Field label="Telefone residencial" name="residentialPhone" defaultValue={contact?.residentialPhone} />
          <Field label="Telefone do assistente" name="assistantPhone" defaultValue={contact?.assistantPhone} />
          <Field label="Data de aniversário" name="birthday" type="date" defaultValue={toDateInputValue(contact?.birthday)} />
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Origem e relacionamento
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fonte de cliente potencial" name="leadSource" defaultValue={contact?.leadSource} />
          <Field label="Nome fornecedor" name="supplierName" defaultValue={contact?.supplierName} />
          <Select
            label="Potencial comercial"
            name="commercialPotential"
            defaultValue={contact?.commercialPotential}
            options={[
              { value: "ALTO", label: "Alto" },
              { value: "MEDIO", label: "Médio" },
              { value: "BAIXO", label: "Baixo" },
            ]}
          />
          <Select
            label="Status CRM"
            name="crmStatus"
            defaultValue={contact?.crmStatus}
            options={[
              { value: "LEAD", label: "Lead" },
              { value: "ATIVO", label: "Ativo" },
              { value: "INATIVO", label: "Inativo" },
            ]}
          />
          <Field label="Próximo contato" name="nextContactAt" type="date" defaultValue={toDateInputValue(contact?.nextContactAt)} />
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Endereço
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rua" name="street" value={street} onChange={setStreet} />
          <Field label="Número" name="number" value={number} onChange={setNumber} />
          <Field label="Cidade" name="city" value={city} onChange={setCity} />
          <Field label="Estado" name="state" value={state} onChange={setState} />
          <Field label="CEP" name="postalCode" value={postalCode} onChange={setPostalCode} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude" name="latitude" type="number" defaultValue={contact?.latitude} />
            <Field label="Longitude" name="longitude" type="number" defaultValue={contact?.longitude} />
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Observações
        </h4>
        <label className="flex flex-col gap-1 text-xs">
          <textarea
            name="notes"
            rows={3}
            defaultValue={contact?.notes ?? ""}
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
      </section>

      <div className="flex justify-end gap-2">
        <Link
          href={cancelHref}
          className="rounded-lg border border-gold-deep px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-gold"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-gold-solid px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-solid-bright"
        >
          {contact ? "Salvar alterações" : "Criar contato"}
        </button>
      </div>
    </form>
  );
}
