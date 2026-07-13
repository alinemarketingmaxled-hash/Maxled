import Link from "next/link";

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  accountName: string | null;
};

export function ContactListPanel({
  contacts,
  selectedId,
}: {
  contacts: ContactRow[];
  selectedId?: string;
}) {
  return (
    <div className="max-h-[640px] overflow-y-auto rounded-xl border border-gold-deep/30 bg-surface p-2.5">
      {contacts.length === 0 && (
        <p className="p-3 text-xs text-ink-faint">Nenhum contato ainda.</p>
      )}
      {contacts.map((c) => {
        const initials = `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
        const active = c.id === selectedId;
        return (
          <Link
            key={c.id}
            href={`/vendas?id=${c.id}`}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm transition-colors ${
              active ? "bg-surface-2" : "hover:bg-surface-2"
            }`}
          >
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-[11px] font-bold text-gold-bright">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-ink">
                {c.firstName} {c.lastName}
              </div>
              <div className="truncate text-[10.5px] text-ink-faint">{c.accountName ?? "—"}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
