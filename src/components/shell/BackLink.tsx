import Link from "next/link";

export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="mb-4 inline-block text-xs text-ink-muted hover:text-gold-bright">
      ← {label}
    </Link>
  );
}
