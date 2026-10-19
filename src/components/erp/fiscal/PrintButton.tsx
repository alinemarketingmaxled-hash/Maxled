"use client";

import { btnPrimary } from "@/components/erp/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btnPrimary}>
      Imprimir
    </button>
  );
}
