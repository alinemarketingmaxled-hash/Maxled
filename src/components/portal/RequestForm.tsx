"use client";

import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { btnPrimary, inputCls, labelCls } from "@/components/erp/ui";

export function RequestForm({
  action,
  defaultType = "CADASTRO",
  types,
  placeholder,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  defaultType?: string;
  types: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess className="flex flex-col gap-3">
      {types.length > 1 ? (
        <label className={labelCls}>
          <span>Tipo</span>
          <select name="type" defaultValue={defaultType} className={inputCls}>
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="type" value={types[0]?.value ?? defaultType} />
      )}
      <label className={labelCls}>
        <span>Mensagem</span>
        <textarea name="message" required minLength={5} maxLength={4000} rows={4} placeholder={placeholder} className={inputCls} />
      </label>
      <div>
        <button type="submit" className={btnPrimary}>
          Enviar solicitação
        </button>
      </div>
    </ActionForm>
  );
}
