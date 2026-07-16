"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/generated/prisma/client";

const ROLES: { value: string; label: string }[] = [
  { value: "SELLER", label: "Vendedor" },
  { value: "SUPPORT", label: "Suporte" },
  { value: "MANAGER", label: "Gerente" },
  { value: "ADMIN", label: "Admin" },
  { value: "MEDIATOR", label: "Mediador" },
];

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-ink-faint">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        step={type === "number" ? "any" : undefined}
        defaultValue={defaultValue ?? ""}
        className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
      />
    </label>
  );
}

export function VendorForm({
  vendor,
  action,
}: {
  vendor?: User | null;
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res.error) {
        setError(res.error);
      } else {
        router.push("/perfil");
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-gold-deep/30 bg-surface p-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" name="name" defaultValue={vendor?.name} required />
        <Field label="E-mail" name="email" type="email" defaultValue={vendor?.email} required />
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">Perfil de acesso</span>
          <select
            name="role"
            defaultValue={vendor?.role ?? "SELLER"}
            className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <Field label="Função" name="jobTitle" defaultValue={vendor?.jobTitle} />
        <Field
          label="Senha"
          name="password"
          type="password"
          required={!vendor}
        />
        <Field
          label="Data de aniversário"
          name="birthday"
          type="date"
          defaultValue={vendor?.birthday ? vendor.birthday.toISOString().slice(0, 10) : null}
        />
      </div>

      <div className="border-t border-gold-deep/20 pt-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Metas e comissão
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta 1 (R$)" name="goal1" type="number" defaultValue={vendor?.goal1 ? Number(vendor.goal1) : null} />
          <Field
            label="Comissão da Meta 1 (%)"
            name="commissionPct1"
            type="number"
            defaultValue={vendor?.commissionPct1 ? Number(vendor.commissionPct1) : null}
          />
          <Field label="Meta 2 (R$)" name="goal2" type="number" defaultValue={vendor?.goal2 ? Number(vendor.goal2) : null} />
          <Field
            label="Comissão da Meta 2 (%)"
            name="commissionPct2"
            type="number"
            defaultValue={vendor?.commissionPct2 ? Number(vendor.commissionPct2) : null}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-gold-solid px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Salvando…" : vendor ? "Salvar alterações" : "Criar vendedor"}
        </button>
      </div>
    </form>
  );
}
