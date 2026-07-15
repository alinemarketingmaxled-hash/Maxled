import { requireView } from "@/lib/require-permission";
import { listPosts } from "@/lib/social";
import { PostComposer } from "@/components/social/PostComposer";
import { PostFeed } from "@/components/social/PostFeed";

export default async function SocialPage() {
  const session = await requireView("social");
  const posts = await listPosts(session);

  const initials = (session.user.name ?? session.user.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Rede Social Interna</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Mural da equipe · todos podem postar, curtir e comentar
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <PostComposer authorInitials={initials} />
        <PostFeed
          posts={posts.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            comments: p.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
          }))}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
