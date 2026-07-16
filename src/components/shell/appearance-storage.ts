export type Theme = "dark" | "light";
export type FontScale = "normal" | "large" | "xlarge";

export const THEME_KEY = "maxled-theme";
export const FONT_SCALE_KEY = "maxled-font-scale";

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Escuro (padrão)" },
  { value: "light", label: "Claro" },
];

export const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Grande" },
  { value: "xlarge", label: "Extra grande" },
];

export function applyAppearance(theme: Theme, fontScale: FontScale) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");

  if (fontScale === "normal") root.removeAttribute("data-font-scale");
  else root.setAttribute("data-font-scale", fontScale);
}

/**
 * localStorage-backed store for useSyncExternalStore — the React-blessed
 * way to read external mutable state without a hydration mismatch (server
 * snapshot always "dark"/"normal", client re-syncs to the saved value
 * right after hydration with no console warning) or the lint error that
 * comes from setState-ing inside a plain useEffect.
 */
const listeners = new Set<() => void>();

export function subscribeAppearance(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAppearanceChanged() {
  for (const listener of listeners) listener();
}

export function getThemeSnapshot(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme | null) ?? "dark";
}
export function getServerTheme(): Theme {
  return "dark";
}

export function getFontScaleSnapshot(): FontScale {
  return (localStorage.getItem(FONT_SCALE_KEY) as FontScale | null) ?? "normal";
}
export function getServerFontScale(): FontScale {
  return "normal";
}

/**
 * Runs before hydration (see app/layout.tsx) so the page never flashes the
 * dark/normal default before switching to a saved preference. Kept as a
 * plain string (not JSX) so it can be shared with AppearanceSettings.tsx
 * without duplicating the storage keys and attribute names.
 */
export const APPEARANCE_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    var scale = localStorage.getItem(${JSON.stringify(FONT_SCALE_KEY)});
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    if (scale === "large" || scale === "xlarge") document.documentElement.setAttribute("data-font-scale", scale);
  } catch (e) {}
})();
`;
