"use client";

import { btnSecondary } from "@/components/erp/ui";

export function PrintButton({ label = "Imprimir lista de separação" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${btnSecondary} print:hidden`}>
      {label}
    </button>
  );
}
