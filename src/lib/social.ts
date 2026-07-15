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

export async function deletePost(session: Session, postId: string) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  if (post.authorId !== session.user.id) {
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
