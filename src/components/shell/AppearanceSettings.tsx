"use client";

import { useSyncExternalStore } from "react";
import {
  applyAppearance,
  FONT_SCALE_KEY,
  FONT_SCALE_OPTIONS,
  getFontScaleSnapshot,
  getServerFontScale,
  getServerTheme,
  getThemeSnapshot,
  notifyAppearanceChanged,
  subscribeAppearance,
  THEME_KEY,
  THEME_OPTIONS,
  type FontScale,
  type Theme,
} from "@/components/shell/appearance-storage";

export function AppearanceSettings() {
  const theme = useSyncExternalStore(subscribeAppearance, getThemeSnapshot, getServerTheme);
  const fontScale = useSyncExternalStore(subscribeAppearance, getFontScaleSnapshot, getServerFontScale);

  function handleTheme(next: Theme) {
    localStorage.setItem(THEME_KEY, next);
    applyAppearance(next, fontScale);
    notifyAppearanceChanged();
  }

  function handleFontScale(next: FontScale) {
    localStorage.setItem(FONT_SCALE_KEY, next);
    applyAppearance(theme, next);
    notifyAppearanceChanged();
  }

  return (
    <div className="mb-4 rounded-xl border border-gold-deep/30 bg-surface p-4">
      <h3 className="mb-3 text-[13px] font-semibold text-ink">Aparência</h3>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Tema</p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleTheme(opt.value)}
                className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  theme === opt.value
                    ? "border-gold-solid bg-gold-solid text-black"
                    : "border-gold-deep text-ink hover:border-gold"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Tamanho da letra</p>
          <div className="flex gap-2">
            {FONT_SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleFontScale(opt.value)}
                className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  fontScale === opt.value
                    ? "border-gold-solid bg-gold-solid text-black"
                    : "border-gold-deep text-ink hover:border-gold"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        Essas preferências ficam salvas neste navegador.
      </p>
    </div>
  );
}
