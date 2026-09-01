"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Contact } from "@/generated/prisma/client";
import {
  lookupCnpjAction,
  lookupCepAction,
  checkContactDuplicateAction,
} from "@/app/(app)/vendas/actions";
import type { ContactDuplicateMatch } from "@/lib/contacts";

type Owner = { id: string; name: string };

const FIXED_PROFILES = ["Indústria", "Comércio", "Serviços", "Construção", "Distribuidor", "Pessoa física", "Outro"];

function Field({
  label,
  name,
  defaultValue,
  value,
  onChange,
  onBlur,
  onFocus,
  type = "text",
  required,
  list,
  listOptions,
  emphasis,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  onFocus?: () => void;
  type?: string;
  required?: boolean;
  /** Id of a <datalist> to attach — pass listOptions to have this component
   * render that datalist for you. */
  list?: string;
  listOptions?: string[];
  /** Visually promotes this field (gold border) — used for Celular/WhatsApp,
   * the phone that actually powers the wa.me links elsewhere in the app. */
  emphasis?: boolean;
}) {
  const controlled = value !== undefined;
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-ink-faint">
        {label}
        {required && <span className="text-gold-bright"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        list={list}
        {...(controlled
          ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
        onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
        onFocus={onFocus}
        step={type === "number" ? "any" : undefined}
        className={`rounded-md border ${
          emphasis ? "border-gold" : "border-gold-deep/40"
        } bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold`}
      />
      {list && listOptions && (
        <datalist id={list}>
          {listOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
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
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DuplicateWarning({ match, label }: { match: ContactDuplicateMatch; label: string }) {
  return (
    <p className="col-span-2 -mt-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
      Já existe um contato com este {label}: {match.name}
      {match.accountName ? ` (${match.accountName})` : ""}.{" "}
      <Link href={`/vendas?id=${match.id}`} className="font-semibold underline">
        abrir contato existente
      </Link>
    </p>
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
  action: (formData: FormData) => Promise<{ error?: string; id?: string; ok?: boolean }>;
}) {
  const router = useRouter();
  const cancelHref = contact ? `/vendas?id=${contact.id}` : "/vendas";
  const showOwnerPicker = owners.length > 1;

  const [cnpj, setCnpj] = useState(contact?.cnpj ?? "");
  const [accountName, setAccountName] = useState(contact?.accountName ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [street, setStreet] = useState(contact?.street ?? "");
  const [number, setNumber] = useState(contact?.number ?? "");
  const [city, setCity] = useState(contact?.city ?? "");
  const [state, setState] = useState(contact?.state ?? "");
  const [postalCode, setPostalCode] = useState(contact?.postalCode ?? "");
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [isLookingUp, startLookup] = useTransition();
  const [cepError, setCepError] = useState<string | null>(null);
  const [isLookingUpCep, startCepLookup] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const [emailDup, setEmailDup] = useState<ContactDuplicateMatch | null>(null);
  const [cnpjDup, setCnpjDup] = useState<ContactDuplicateMatch | null>(null);

  const isCustomProfile = !!contact?.profile && !FIXED_PROFILES.includes(contact.profile);
  const [profileSelect, setProfileSelect] = useState(() =>
    !contact?.profile ? "" : isCustomProfile ? "Outro" : contact.profile,
  );
  const [profileOther, setProfileOther] = useState(() => (isCustomProfile ? contact!.profile! : ""));

  const hasSecondaryPhone = !!(contact?.phone || contact?.residentialPhone || contact?.assistantPhone);

  // Esc closes the form the same way the "Cancelar" link does — back to the
  // client list or, when editing, to that client's detail view.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.push(cancelHref);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, cancelHref]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Deliberately onSubmit + manual FormData, not <form action={...}>: React
    // resets uncontrolled fields after any form action resolves — including
    // one that returns {error} rather than throwing — which was wiping the
    // whole form (including firstName/lastName) right when the user needed
    // to fix and resubmit it.
    const formData = new FormData(e.currentTarget);
    formData.set("profile", profileSelect === "Outro" ? profileOther : profileSelect);
    setFormError(null);
    startSave(async () => {
      let response;
      try {
        response = await action(formData);
      } catch {
        setFormError("Não foi possível salvar o cliente agora. Tente novamente em instantes.");
        return;
      }
      if (response.error) {
        setFormError(response.error);
        return;
      }
      router.push(response.id ? `/vendas?id=${response.id}` : cancelHref);
      router.refresh();
    });
  }

  function handleLookupCnpj() {
    setCnpjError(null);
    startLookup(async () => {
      let outcome;
      try {
        outcome = await lookupCnpjAction(cnpj);
      } catch {
        // A server action can reject outright (network/RPC failure, session
        // hiccup, etc.) — without this catch, that crashed the whole page
        // instead of showing a message, same class of bug fixed elsewhere.
        setCnpjError(
          "Não foi possível consultar o CNPJ agora. Tente de novo em instantes ou preencha manualmente.",
        );
        return;
      }
      if (!outcome.ok) {
        setCnpjError(
          outcome.reason === "invalid"
            ? "CNPJ incompleto. Digite os 14 números do CNPJ."
            : outcome.reason === "not_found"
              ? "CNPJ não encontrado na Receita Federal. Confira o número ou preencha manualmente."
              : "Não foi possível consultar o CNPJ agora (falha de conexão). Tente de novo em instantes ou preencha manualmente.",
        );
        return;
      }
      const { result } = outcome;
      if (result.accountName) setAccountName(result.accountName);
      if (result.phone) setPhone(result.phone);
      if (result.street) setStreet(result.street);
      if (result.number) setNumber(result.number);
      if (result.city) setCity(result.city);
      if (result.state) setState(result.state);
      if (result.postalCode) setPostalCode(result.postalCode);
    });
  }

  function handleLookupCep() {
    setCepError(null);
    startCepLookup(async () => {
      let outcome;
      try {
        outcome = await lookupCepAction(postalCode);
      } catch {
        setCepError("Não foi possível consultar o CEP agora. Tente de novo em instantes ou preencha manualmente.");
        return;
      }
      if (!outcome.ok) {
        setCepError(
          outcome.reason === "invalid"
            ? "CEP incompleto. Digite os 8 números do CEP."
            : outcome.reason === "not_found"
              ? "CEP não encontrado. Confira o número ou preencha manualmente."
              : "Não foi possível consultar o CEP agora (falha de conexão). Tente de novo em instantes ou preencha manualmente.",
        );
        return;
      }
      // ViaCEP has no latitude/longitude — Latitude/Longitude stay manual
      // fields untouched by this lookup.
      if (outcome.result.street) setStreet(outcome.result.street);
      setCity(outcome.result.city ?? "");
      setState(outcome.result.state ?? "");
      setPostalCode(outcome.result.postalCode);
    });
  }

  async function checkEmailDuplicate(value: string) {
    const v = value.trim();
    if (!v) {
      setEmailDup(null);
      return;
    }
    try {
      const result = await checkContactDuplicateAction({ email: v, excludeId: contact?.id ?? null });
      setEmailDup(result.email);
    } catch {
      // Advisory only — a failed check just means no warning shows.
    }
  }

  async function checkCnpjDuplicate(value: string) {
    if (value.replace(/\D/g, "").length < 14) {
      setCnpjDup(null);
      return;
    }
    try {
      const result = await checkContactDuplicateAction({ cnpj: value, excludeId: contact?.id ?? null });
      setCnpjDup(result.cnpj);
    } catch {
      // Advisory only.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <p className="-mt-2 rounded-md bg-surface-2 px-3 py-2 text-[11.5px] text-ink-muted">
        Cadastro rápido: preencha Nome, Sobrenome e um jeito de contato (e-mail ou celular). O resto pode ser
        completado depois.
      </p>

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
          <Field label="Nome" name="firstName" defaultValue={contact?.firstName} required />
          <Field label="Sobrenome" name="lastName" defaultValue={contact?.lastName} required />
          <div className="col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <Field
                label="CNPJ"
                name="cnpj"
                value={cnpj}
                onChange={(v) => {
                  setCnpj(v);
                  setCnpjDup(null);
                }}
                onBlur={checkCnpjDuplicate}
              />
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
          {cnpjDup && <DuplicateWarning match={cnpjDup} label="CNPJ" />}
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
          <Field
            label="E-mail"
            name="email"
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              setEmailDup(null);
            }}
            onBlur={checkEmailDuplicate}
          />
          {emailDup && <DuplicateWarning match={emailDup} label="e-mail" />}
          <Field label="Celular / WhatsApp" name="mobile" defaultValue={contact?.mobile} emphasis />
          <Field
            label="Data de aniversário"
            name="birthday"
            type="date"
            defaultValue={toDateInputValue(contact?.birthday)}
          />
        </div>

        <details className="mt-3 rounded-lg border border-gold-deep/25 bg-surface-2/40 p-3" open={hasSecondaryPhone}>
          <summary className="cursor-pointer text-xs font-semibold text-ink-muted hover:text-ink">
            Outros telefones (opcional)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Telefone" name="phone" value={phone} onChange={setPhone} />
            <Field label="Telefone residencial" name="residentialPhone" defaultValue={contact?.residentialPhone} />
            <Field label="Telefone do assistente" name="assistantPhone" defaultValue={contact?.assistantPhone} />
          </div>
        </details>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Origem e relacionamento (opcional)
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fonte de cliente potencial" name="leadSource" defaultValue={contact?.leadSource} />
          <Field label="Nome fornecedor" name="supplierName" defaultValue={contact?.supplierName} />
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">Perfil</span>
            <select
              value={profileSelect}
              onChange={(e) => setProfileSelect(e.target.value)}
              className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              <option value="">-</option>
              {FIXED_PROFILES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {profileSelect === "Outro" && (
              <input
                value={profileOther}
                onChange={(e) => setProfileOther(e.target.value)}
                placeholder="Especifique o perfil"
                className="mt-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
              />
            )}
          </label>
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
          Endereço (opcional)
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <Field label="CEP" name="postalCode" value={postalCode} onChange={setPostalCode} />
            </div>
            <button
              type="button"
              onClick={handleLookupCep}
              disabled={!postalCode.replace(/\D/g, "") || isLookingUpCep}
              className="mb-[1px] shrink-0 rounded-md border border-gold-deep px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLookingUpCep ? "Buscando…" : "Buscar CEP"}
            </button>
          </div>
          {cepError && <p className="col-span-2 -mt-2 text-[11px] text-critical">{cepError}</p>}
          <Field label="Rua" name="street" value={street} onChange={setStreet} />
          <Field label="Número" name="number" value={number} onChange={setNumber} />
          <Field label="Cidade" name="city" value={city} onChange={setCity} />
          <Field label="Estado" name="state" value={state} onChange={setState} />
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

      {formError && (
        <div className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-faint">* campos obrigatórios · Esc para fechar</p>
        <div className="flex gap-2">
          <Link
            href={cancelHref}
            className="rounded-lg border border-gold-deep px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-gold"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-gold-solid px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Salvando…" : contact ? "Salvar alterações" : "Criar contato"}
          </button>
        </div>
      </div>
    </form>
  );
}
