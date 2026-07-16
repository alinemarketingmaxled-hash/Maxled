"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPostAction } from "@/app/(app)/social/actions";
import { resizeImageToDataUrl } from "@/lib/resize-image";

export function PostComposer({ authorInitials }: { authorInitials: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 640, 0.8);
      setImageUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível processar a imagem.");
    }
  }

  function handlePublish() {
    if (!body.trim() && !imageUrl) {
      setError("Escreva algo ou adicione uma foto.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createPostAction(body, imageUrl);
        setBody("");
        setImageUrl("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao publicar.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface p-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 text-[11px] font-bold text-gold-bright">
          {authorInitials}
        </div>
        <div className="flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Compartilhe algo com a equipe…"
            rows={2}
            className="w-full rounded-md border border-gold-deep/40 bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-gold"
          />
          {imageUrl && (
            <div className="relative mt-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Prévia" className="max-h-48 rounded-lg border border-gold-deep/30" />
              <button
                onClick={() => setImageUrl("")}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-xs text-ink-muted hover:text-critical"
              >
                ×
              </button>
            </div>
          )}
          {error && <p className="mt-1.5 text-[11.5px] text-critical">{error}</p>}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-gold-deep px-3 py-1.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-gold"
            >
              📷 Foto
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="ml-auto rounded-lg bg-gold-solid px-4 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
