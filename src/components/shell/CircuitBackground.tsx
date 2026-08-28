/** Faint gold grid ("quadriculado") texture, painted behind app content —
 * a deliberately subtle checkerboard of hairlines rather than a busy
 * pattern. Renders its own ground-color fill too, so it must replace (not
 * sit behind) any solid bg-ground on its positioned parent. */
export function CircuitBackground() {
  return <div aria-hidden="true" className="app-grid-bg pointer-events-none absolute inset-0 z-0 h-full w-full" />;
}
