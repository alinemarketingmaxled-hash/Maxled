"use client";

/**
 * Fallback for any uncaught error inside the app shell — without this,
 * an uncaught exception anywhere under (app) crashes to Next.js's generic
 * "This page couldn't load" screen with a numeric error code, which is
 * confusing with no way to recover except a hard reload. This gives a
 * plain-language message and a retry button instead. Individual features
 * should still prefer catching their own errors and showing a specific
 * message (see the {error}/{ok} pattern used across server actions) —
 * this is the safety net for whatever slips through.
 */
export default function AppError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <h2 className="font-display text-xl text-ink">Algo deu errado</h2>
      <p className="max-w-sm text-sm text-ink-muted">
        Essa parte do CRM travou de forma inesperada. Tente novamente — se continuar
        acontecendo, me avise o que você estava fazendo.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-lg bg-gold-solid px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-solid-bright"
      >
        Tentar novamente
      </button>
    </div>
  );
}
