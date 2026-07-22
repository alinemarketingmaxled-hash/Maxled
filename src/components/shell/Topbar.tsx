import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { SearchBar } from "@/components/shell/SearchBar";

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
  onMenuClick,
}: {
  name: string;
  role: string;
  avatarUrl?: string | null;
  onMenuClick?: () => void;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-gold-deep/30 bg-gradient-to-b from-surface to-ground px-3.5 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-gold-deep/40 text-ink-muted hover:border-gold hover:text-ink lg:hidden"
        >
          ☰
        </button>
      )}
      <SearchBar />
      <div className="ml-auto flex items-center gap-2.5 sm:gap-3.5">
        <span className="hidden text-xs text-ink-muted sm:inline">{ROLE_LABELS[role] ?? role}</span>
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
