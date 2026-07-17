import Link from "next/link";

export type ImportantPost = { id: string; body: string | null; authorName: string | null; createdAt: string };

/** Left-nav "Comunicados" widget — the mediator's pinned announcements,
 * always visible (não só na Início) so ninguém precisa abrir o mural. */
export function ComunicadosWidget({ posts }: { posts: ImportantPost[] }) {
  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">Comunicados</h4>
        <Link href="/social" className="text-[10px] text-gold-bright hover:underline">
          Ver todos
        </Link>
      </div>
      {posts.length === 0 ? (
        <p className="text-[10.5px] text-ink-faint">Nenhum comunicado importante no momento.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((p) => (
            <div key={p.id} className="border-b border-dashed border-gold-deep/25 pb-2 text-[11px] last:border-b-0 last:pb-0">
              <p className="line-clamp-2 text-ink">{p.body}</p>
              <p className="mt-0.5 text-[10px] text-ink-faint">
                {p.authorName} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
