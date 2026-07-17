"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toggleLikeAction, deletePostAction, addCommentAction, toggleImportantAction } from "@/app/(app)/social/actions";

type Author = { id: string; name: string; avatarUrl: string | null };
type Comment = { id: string; body: string; createdAt: string; author: Author };
export type FeedPost = {
  id: string;
  body: string | null;
  imageUrl: string | null;
  important: boolean;
  createdAt: string;
  author: Author;
  likeCount: number;
  likedByMe: boolean;
  comments: Comment[];
};

function Avatar({ author, size = "md" }: { author: Author; size?: "sm" | "md" }) {
  const initials = author.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const dims = size === "sm" ? "h-6 w-6" : "h-9 w-9";
  const cls = `${dims} flex-none rounded-full border border-gold-deep object-cover`;
  if (author.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={author.avatarUrl} alt={author.name} className={cls} />;
  }
  return (
    <div
      className={`flex ${dims} flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-[10.5px] font-bold text-gold-bright`}
    >
      {initials}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  isMediator,
}: {
  post: FeedPost;
  currentUserId: string;
  isMediator: boolean;
}) {
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [important, setImportant] = useState(post.important);
  const [showComments, setShowComments] = useState(post.comments.length > 0);
  const [commentBody, setCommentBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLike() {
    setLikedByMe((v) => !v);
    setLikeCount((c) => (likedByMe ? c - 1 : c + 1));
    startTransition(async () => {
      await toggleLikeAction(post.id);
      router.refresh();
    });
  }

  function handleToggleImportant() {
    setImportant((v) => !v);
    startTransition(async () => {
      await toggleImportantAction(post.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Excluir esta publicação?")) return;
    startTransition(async () => {
      await deletePostAction(post.id);
      router.refresh();
    });
  }

  function handleComment() {
    if (!commentBody.trim()) return;
    startTransition(async () => {
      await addCommentAction(post.id, commentBody);
      setCommentBody("");
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        important ? "border-gold-solid bg-gold-solid/[0.06]" : "border-gold-deep/30 bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar author={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-ink">{post.author.name}</span>
            <span className="text-[11px] text-ink-faint">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ptBR })}
            </span>
            {important && (
              <span className="rounded-full bg-gold-solid/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold-bright">
                ★ Importante
              </span>
            )}
            <div className="ml-auto flex items-center gap-2.5">
              {isMediator && (
                <button
                  onClick={handleToggleImportant}
                  disabled={isPending}
                  className="text-[11px] text-ink-faint hover:text-gold-bright disabled:opacity-50"
                >
                  {important ? "Remover destaque" : "Marcar importante"}
                </button>
              )}
              {post.author.id === currentUserId && (
                <button onClick={handleDelete} className="text-[11px] text-ink-faint hover:text-critical">
                  Excluir
                </button>
              )}
            </div>
          </div>
          {post.body && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-ink">{post.body}</p>}
          {post.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.imageUrl}
              alt=""
              className="mt-2.5 max-h-96 w-full rounded-lg border border-gold-deep/25 object-cover"
            />
          )}

          <div className="mt-3 flex items-center gap-4 border-t border-gold-deep/20 pt-2.5">
            <button
              onClick={handleLike}
              disabled={isPending}
              className={`flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${
                likedByMe ? "text-gold-bright" : "text-ink-faint hover:text-ink"
              }`}
            >
              {likedByMe ? "★" : "☆"} {likeCount > 0 && likeCount}
            </button>
            <button
              onClick={() => setShowComments((v) => !v)}
              className="text-[12px] font-semibold text-ink-faint hover:text-ink"
            >
              💬 {post.comments.length > 0 ? post.comments.length : "Comentar"}
            </button>
          </div>

          {showComments && (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-gold-deep/20 pt-2.5">
              {post.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar author={c.author} size="sm" />
                  <div className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px]">
                    <b className="text-ink">{c.author.name}</b>{" "}
                    <span className="text-ink-muted">{c.body}</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder="Escreva um comentário…"
                  className="flex-1 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-gold"
                />
                <button
                  onClick={handleComment}
                  disabled={isPending || !commentBody.trim()}
                  className="rounded-md bg-gold-solid px-3 py-1.5 text-[11.5px] font-semibold text-black hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PostFeed({
  posts,
  currentUserId,
  isMediator,
}: {
  posts: FeedPost[];
  currentUserId: string;
  isMediator: boolean;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gold-deep/40 bg-surface px-6 py-10 text-center text-sm text-ink-muted">
        Nenhuma publicação ainda. Seja o primeiro a postar algo no mural!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} isMediator={isMediator} />
      ))}
    </div>
  );
}
