"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDealAction } from "@/app/(app)/negocios/actions";

type ContactOption = {
  id: string;
  firstName: string;
  lastName: string;
  accountName: string | null;
  phone: string | null;
  mobile: string | null;
  cnpj: string | null;
};

function companyLabel(c: ContactOption) {
  return c.accountName ?? `${c.firstName} ${c.lastName}`;
}

export function NewDealForm({
  contacts,
  owners,
  stages,
  defaultOwnerId,
  cancelHref,
}: {
  contacts: ContactOption[];
  owners: { id: string; name: string | null }[];
  stages: { id: string; name: string }[];
  defaultOwnerId: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ContactOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const suggestions = useMemo(() => {
    if (selected || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => companyLabel(c).toLowerCase().includes(q)).slice(0, 8);
  }, [contacts, query, selected]);

  function handleSelect(c: ContactOption) {
    setSelected(c);
    setQuery(companyLabel(c));
  }

  function handleChangeCompany() {
    setSelected(null);
    setQuery("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) {
      setError("Selecione a empresa/cliente na lista.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    formData.set("name", query.trim());
    formData.set("contactId", selected.id);
    setError(null);
    startSave(async () => {
      let response;
      try {
        response = await createDealAction(formData);
      } catch {
        setError("Não foi possível criar o negócio agora. Tente novamente em instantes.");
        return;
      }
      if (response.error) {
        setError(response.error);
        return;
      }
      router.push("/negocios");
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-gold-deep/30 bg-surface p-5"
    >
      {error && (
        <p className="rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{error}</p>
      )}

      {owners.length > 1 ? (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Vendedor</span>
          <select
            name="ownerId"
            defaultValue={defaultOwnerId}
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
        <input type="hidden" name="ownerId" value={defaultOwnerId} />
      )}

      <div className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Empresa / cliente — também será o título do negócio</span>
        {selected ? (
          <div className="rounded-md border border-gold-deep/40 bg-surface-2 p-2.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-ink outline-none"
            />
            <div className="mt-2 flex flex-col gap-0.5 border-t border-gold-deep/25 pt-2 text-[11px] text-ink-faint">
              <span>
                Contato: <span className="text-ink">{selected.firstName} {selected.lastName}</span>
              </span>
              <span>
                Telefone:{" "}
                <span className="text-ink">{selected.phone ?? selected.mobile ?? "—"}</span>
              </span>
              <span>
                CNPJ: <span className="text-ink">{selected.cnpj ?? "—"}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleChangeCompany}
              className="mt-2 text-[11px] font-semibold text-gold-bright hover:underline"
            >
              Trocar empresa/cliente
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o nome da empresa ou cliente…"
              autoComplete="off"
              className="w-full rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-gold-deep/40 bg-surface-2 shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(c)}
                      className="flex w-full flex-col items-start px-2.5 py-1.5 text-left text-xs text-ink hover:bg-surface-3"
                    >
                      <span className="font-semibold">{companyLabel(c)}</span>
                      {c.accountName && (
                        <span className="text-[10.5px] text-ink-faint">
                          {c.firstName} {c.lastName}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Valor (R$)</span>
        <input
          name="value"
          type="number"
          step="0.01"
          min="0"
          required
          className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Estágio inicial</span>
        <select
          name="stageId"
          defaultValue={stages[0]?.id}
          className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-lg border border-gold-deep px-4 py-2 text-xs font-semibold text-ink"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-gold-solid px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:opacity-60"
        >
          {isSaving ? "Criando…" : "Criar negócio"}
        </button>
      </div>
    </form>
  );
}
