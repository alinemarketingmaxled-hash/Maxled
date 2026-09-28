"use client";

import { useTransition } from "react";
import { setFitThemeAction } from "@/app/fit/actions";
import { MoonI, SunI } from "./FitIcons";

export function ThemeToggle({ theme }: { theme: "dark" | "light" }) {
  const [pending, start] = useTransition();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setFitThemeAction(next))}
      className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm"
    >
      <span>Tema {theme === "dark" ? "escuro" : "claro"}</span>
      <span className="flex items-center gap-1 rounded-full bg-fit-card-2 p-1">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${theme === "dark" ? "bg-fit-lime text-fit-on-lime" : "text-fit-muted"}`}>
          <MoonI className="h-4 w-4" />
        </span>
        <span className={`grid h-7 w-7 place-items-center rounded-full ${theme === "light" ? "bg-fit-lime text-fit-on-lime" : "text-fit-muted"}`}>
          <SunI className="h-4 w-4" />
        </span>
      </span>
    </button>
  );
}
