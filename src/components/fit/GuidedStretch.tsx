"use client";

import { useRouter } from "next/navigation";
import { StretchSession, type SessionStretch } from "./StretchSession";

/** Full-screen guided stretch opened from a link; closing goes back. */
export function GuidedStretch({ title, items, backHref }: { title: string; items: SessionStretch[]; backHref: string }) {
  const router = useRouter();
  return <StretchSession title={title} items={items} onClose={() => router.push(backHref)} doneLabel="Voltar ao treino" />;
}
