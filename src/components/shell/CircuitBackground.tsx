/** Faint gold circuit-trace texture, painted behind app content — the same
 * motif as the logo, applied ambiently across the app per the brand brief.
 * Renders its own ground-color fill too, so it must replace (not sit behind)
 * any solid bg-ground on its positioned parent. */
export function CircuitBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    >
      <defs>
        <pattern id="circuitPattern" width="160" height="160" patternUnits="userSpaceOnUse">
          <g stroke="var(--gold-circuit)" strokeWidth="1.25" fill="none" opacity="0.22">
            <path d="M0 24 H44 L54 34 H100 L110 24 H160" />
            <path d="M24 0 V38 L34 48 V100 L24 110 V160" />
            <path d="M0 130 H30 L40 120 H90 L100 130 H160" />
            <path d="M120 0 V50 L130 60 V160" />
            <circle cx="54" cy="34" r="2.2" fill="var(--gold-circuit)" />
            <circle cx="110" cy="24" r="2.2" fill="var(--gold-circuit)" />
            <circle cx="34" cy="48" r="2.2" fill="var(--gold-circuit)" />
            <circle cx="24" cy="110" r="2.2" fill="var(--gold-circuit)" />
            <circle cx="40" cy="120" r="2.2" fill="var(--gold-circuit)" />
            <circle cx="100" cy="130" r="2.2" fill="var(--gold-circuit)" />
            <circle cx="130" cy="60" r="2.2" fill="var(--gold-circuit)" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="var(--black-ground)" />
      <rect width="100%" height="100%" fill="url(#circuitPattern)" />
    </svg>
  );
}
