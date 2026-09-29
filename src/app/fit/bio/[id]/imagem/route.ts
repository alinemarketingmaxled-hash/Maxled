import { prisma } from "@/lib/prisma";
import { currentFitAccount } from "@/lib/fit/account";

/** Serves the report print attached to a bio — only to its owner. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await currentFitAccount();
  if (!account) return new Response("Não autorizado", { status: 401 });
  const { id } = await params;
  const image = await prisma.fitBioImage.findFirst({
    where: { bioId: id, bio: { accountId: account.id } },
    select: { mimeType: true, data: true },
  });
  if (!image) return new Response("Não encontrada", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=86400" },
  });
}
