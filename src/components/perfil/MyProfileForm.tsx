"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnProfileAction } from "@/app/(app)/meu-perfil/actions";
import { resizeImageToDataUrl } from "@/lib/resize-image";

export function MyProfileForm({
  user,
}: {
  user: { name: string; avatarUrl: string | null; birthday: Date | null; goal1: number | null };
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível processar a imagem.");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    formData.set("avatarUrl", avatarUrl);
    startTransition(async () => {
      try {
        await updateOwnProfileAction(formData);
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar perfil.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-gold-deep/30 bg-surface p-5">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Foto de perfil"
            className="h-20 w-20 flex-none rounded-full border border-gold-deep object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 font-display text-2xl text-gold-bright">
            {initials}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gold-deep px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
          >
            Alterar foto
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl("")}
              className="text-[11.5px] font-semibold text-ink-faint hover:text-critical"
            >
              Remover foto
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Nome</span>
        <input
          name="name"
          required
          defaultValue={user.name}
          className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Data de nascimento</span>
        <input
          name="birthday"
          type="date"
          defaultValue={user.birthday ? user.birthday.toISOString().slice(0, 10) : ""}
          className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Minha meta (R$)</span>
        <input
          name="goal1"
          type="number"
          step="any"
          min="0"
          defaultValue={user.goal1 ?? ""}
          className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink-faint">Nova senha (deixe em branco para manter a atual)</span>
        <input
          name="password"
          type="password"
          className="rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-[12.5px] text-good">
          Perfil atualizado.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-gold-solid px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
