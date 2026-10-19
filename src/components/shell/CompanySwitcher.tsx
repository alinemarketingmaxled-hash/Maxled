"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setActiveCompany } from "@/lib/erp/company-actions";
import { BuildingIcon } from "@/components/shared/Icons";

export type CompanyOption = { id: string; code: string; name: string };

/** Ao trocar de empresa volta para a raiz do módulo atual: uma tela de
 * detalhe aberta (pedido, nota, título) pertence à empresa anterior e não
 * pode continuar visível (§2). */
export function CompanySwitcher({ companies, activeId }: { companies: CompanyOption[]; activeId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  if (companies.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gold-deep/40 px-2.5 py-2 text-[11px] text-ink-faint">
        Sem empresa vinculada. Peça acesso ao administrador.
      </p>
    );
  }

  return (
    <label className="flex flex-col gap-1 px-1">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
        <BuildingIcon className="h-3 w-3" /> Empresa ativa
      </span>
      <select
        value={activeId ?? ""}
        disabled={pending || companies.length < 2}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            await setActiveCompany(id);
            const root = "/" + (pathname.split("/")[1] ?? "");
            router.push(root);
            router.refresh();
          });
        }}
        className="w-full rounded-lg border border-gold-deep/45 bg-surface-2 px-2 py-1.5 text-[12.5px] text-ink focus:border-gold focus:outline-none disabled:opacity-80"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} · {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
