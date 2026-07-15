import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Gerente",
  SELLER: "Vendedor",
  SUPPORT: "Suporte",
  MEDIATOR: "Mediador",
};

export function Topbar({
  name,
  role,
  avatarUrl,
}: {
  name: string;
  role: string;
  avatarUrl?: string | null;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-gold-deep/30 bg-gradient-to-b from-surface to-ground px-6 py-3.5">
      <input
        placeholder="Buscar contatos, negócios…"
        disabled
        className="max-w-sm flex-1 rounded-lg border border-gold-deep/35 bg-surface-2 px-3 py-2 text-[13px] text-ink-faint outline-none"
      />
      <div className="ml-auto flex items-center gap-3.5">
        <span className="text-xs text-ink-muted">{ROLE_LABELS[role] ?? role}</span>
        <Link href="/meu-perfil" title="Meu perfil">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="h-8 w-8 rounded-full border border-gold-deep object-cover transition-opacity hover:opacity-80"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-[11px] font-bold text-gold-bright transition-colors hover:border-gold">
              {initials}
            </div>
          )}
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
