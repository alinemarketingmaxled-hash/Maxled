import Link from "next/link";
import { ChevronLeftIcon } from "@/components/shared/Icons";

export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold-bright">
      <ChevronLeftIcon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}
