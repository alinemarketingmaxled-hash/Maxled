import type { FiscalDocStatus } from "@/generated/prisma/client";
import { Badge, type Tone } from "@/components/erp/ui";

const TONES: Record<FiscalDocStatus, Tone> = {
  PROCESSANDO: "info",
  AUTORIZADA: "good",
  REJEITADA: "critical",
  CANCELADA: "neutral",
};
const LABELS: Record<FiscalDocStatus, string> = {
  PROCESSANDO: "Processando",
  AUTORIZADA: "Autorizada",
  REJEITADA: "Rejeitada",
  CANCELADA: "Cancelada",
};

export function FiscalStatusBadge({ status }: { status: FiscalDocStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}

/** Chave de acesso em grupos de 4 dígitos, como no DANFE. */
export function formatAccessKey(key: string | null | undefined) {
  return key ? key.replace(/(\d{4})(?=\d)/g, "$1 ") : "-";
}
