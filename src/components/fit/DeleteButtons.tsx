"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteBioAction, deleteWorkoutAction } from "@/app/fit/actions";
import { TrashI } from "./FitIcons";

function DeleteButton({ label, confirmText, run, redirectTo }: { label: string; confirmText: string; run: () => Promise<{ ok: boolean }>; redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => {
        if (!confirm(confirmText)) return;
        start(async () => {
          await run();
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        });
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fit-card-2 text-fit-muted hover:text-fit-bad disabled:opacity-50"
    >
      <TrashI className="h-4 w-4" />
    </button>
  );
}

export function DeleteWorkoutButton({ id }: { id: string }) {
  return <DeleteButton label="Excluir treino" confirmText="Excluir este treino do histórico?" run={() => deleteWorkoutAction(id)} />;
}

export function DeleteBioButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  return (
    <DeleteButton
      redirectTo={redirectTo}
      label="Excluir bioimpedância"
      confirmText="Excluir esta bioimpedância? O treino será recalculado."
      run={() => deleteBioAction(id)}
    />
  );
}
