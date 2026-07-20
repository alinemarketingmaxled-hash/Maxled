"use server";

import { revalidatePath } from "next/cache";
import { requireView } from "@/lib/require-permission";
import { createPost, deletePost, toggleLike, addComment, toggleImportant } from "@/lib/social";

export async function createPostAction(body: string, imageUrl: string) {
  const session = await requireView("social");
  await createPost(session, { body, imageUrl });
  revalidatePath("/social");
}

export async function deletePostAction(postId: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireView("social");
  try {
    await deletePost(session, postId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado ao excluir." };
  }
  revalidatePath("/social");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleLikeAction(postId: string) {
  const session = await requireView("social");
  const liked = await toggleLike(session, postId);
  revalidatePath("/social");
  return liked;
}

export async function addCommentAction(postId: string, body: string) {
  const session = await requireView("social");
  await addComment(session, postId, body);
  revalidatePath("/social");
}

export async function toggleImportantAction(postId: string) {
  const session = await requireView("social");
  const important = await toggleImportant(session, postId);
  revalidatePath("/social");
  revalidatePath("/");
  return important;
}
