"use client";

import { useState } from "react";

export function PrintButton({ className, children = "Baixar PDF / imprimir" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}

export function CopyButton({ text, className, children = "Copiar link" }: { text: string; className?: string; children?: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copie o link:", text);
        }
      }}
    >
      {done ? "Copiado!" : children}
    </button>
  );
}
