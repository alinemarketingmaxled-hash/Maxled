import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_LENGTH = 500_000;

export async function listPosts(session: Session, take = 30) {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      likes: { select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  return posts.map((p) => ({
    id: p.id,
    body: p.body,
    imageUrl: p.imageUrl,
    important: p.important,
    createdAt: p.createdAt,
    author: p.author,
    likeCount: p.likes.length,
    likedByMe: p.likes.some((l) => l.userId === session.user.id),
    comments: p.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: c.author,
    })),
  }));
}

/** Powers the home page's "Comunicados" sidebar card — the most recent
 * posts a Mediator has flagged as important, so nobody has to open the
 * mural to catch a real announcement. */
export async function listImportantPosts(limit = 4) {
  const posts = await prisma.post.findMany({
    where: { important: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { author: { select: { name: true } } },
  });
  return posts.map((p) => ({
    id: p.id,
    body: p.body,
    createdAt: p.createdAt,
    authorName: p.author.name,
  }));
}

export async function toggleImportant(session: Session, postId: string) {
  if (session.user.role !== "MEDIATOR") {
    throw new Error("Apenas o mediador pode marcar um comunicado como importante.");
  }
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const updated = await prisma.post.update({
    where: { id: postId },
    data: { important: !post.important },
  });
  return updated.important;
}

export async function createPost(
  session: Session,
  input: { body?: string | null; imageUrl?: string | null },
) {
  const body = input.body?.trim() || null;
  const imageUrl = input.imageUrl?.trim() || null;
  if (!body && !imageUrl) throw new Error("Escreva algo ou adicione uma foto.");
  if (imageUrl && imageUrl.length > MAX_IMAGE_LENGTH) {
    throw new Error("Imagem muito grande. Escolha uma foto menor.");
  }
  return prisma.post.create({ data: { authorId: session.user.id, body, imageUrl } });
}

/** Authors can delete their own posts; the mediator can also remove anyone
 * else's, same moderation reach as marking a post important. */
export async function deletePost(session: Session, postId: string) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  if (post.authorId !== session.user.id && session.user.role !== "MEDIATOR") {
    throw new Error("Você só pode excluir suas próprias publicações.");
  }
  await prisma.post.delete({ where: { id: postId } });
}

export async function toggleLike(session: Session, postId: string) {
  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });
  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.postLike.create({ data: { postId, userId: session.user.id } });
  return true;
}

export async function addComment(session: Session, postId: string, body: string) {
  if (!body.trim()) throw new Error("Escreva um comentário.");
  return prisma.postComment.create({
    data: { postId, authorId: session.user.id, body: body.trim() },
  });
}
