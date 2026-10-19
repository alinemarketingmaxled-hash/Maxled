"use client";

import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { btnSecondary } from "@/components/erp/ui";

export function AccessRow({
  user,
  companies,
  action,
  editable,
}: {
  user: { id: string; name: string; email: string; roleLabel: string; companyIds: string[]; isMediator: boolean };
  companies: { id: string; code: string; name: string }[];
  action: (fd: FormData) => Promise<ClientActionResult>;
  editable: boolean;
}) {
  const none = user.companyIds.length === 0 && !user.isMediator;
  return (
    <li className="border-b border-dashed border-gold-deep/20 py-2.5 last:border-b-0">
      <ActionForm action={action} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input type="hidden" name="userId" value={user.id} />
        <div className="min-w-[220px] flex-1">
          <div className="text-[13px] font-semibold text-ink">{user.name}</div>
          <div className="text-[11.5px] text-ink-faint">
            {user.email} · {user.roleLabel}
          </div>
          {none && <div className="mt-0.5 text-[11.5px] font-semibold text-critical">Sem empresa: não consegue usar o ERP</div>}
          {user.isMediator && <div className="mt-0.5 text-[11.5px] text-ink-muted">Mediador acessa todas as empresas</div>}
        </div>
        <div className="flex flex-wrap gap-3">
          {companies.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-[13px] text-ink" title={c.name}>
              <input type="checkbox" name="companyIds" value={c.id} defaultChecked={user.companyIds.includes(c.id)} disabled={!editable} />
              {c.code}
            </label>
          ))}
        </div>
        {editable && (
          <button type="submit" className={btnSecondary}>
            Salvar
          </button>
        )}
      </ActionForm>
    </li>
  );
}
