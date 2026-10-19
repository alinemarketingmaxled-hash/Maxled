"use client";

import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { btnPrimary, inputCls } from "@/components/erp/ui";

export function RespondForm({ id, action }: { id: string; action: (fd: FormData) => Promise<ClientActionResult> }) {
  return (
    <ActionForm action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="response" required rows={2} placeholder="Resposta ao cliente (visível no portal)" className={inputCls} />
      <div>
        <button type="submit" className={btnPrimary}>
          Responder e concluir
        </button>
      </div>
    </ActionForm>
  );
}
