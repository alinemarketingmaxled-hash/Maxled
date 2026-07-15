/** Gold ring-and-X mark with circuit traces, matching the Maxled logo. */
export function Logo({ size = 34, withCircuits = false }: { size?: number; withCircuits?: boolean }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className="flex-none"
      role="img"
      aria-label="Maxled"
    >
      <defs>
        <linearGradient id="logoGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0C863" />
          <stop offset="50%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#8A6A1F" />
        </linearGradient>
      </defs>

      {withCircuits && (
        <g stroke="url(#logoGold)" strokeWidth="1.75" fill="none" opacity="0.85" strokeLinecap="round">
          <path d="M0 55 H28 L40 43 H62" />
          <path d="M0 100 H20" />
          <path d="M0 145 H28 L40 157 H62" />
          <path d="M18 30 V50 L30 62 V85" />
          <path d="M200 55 H172 L160 43 H138" />
          <path d="M200 100 H180" />
          <path d="M200 145 H172 L160 157 H138" />
          <path d="M182 30 V50 L170 62 V85" />
          <circle cx="40" cy="43" r="2.5" fill="url(#logoGold)" />
          <circle cx="28" cy="55" r="2.5" fill="url(#logoGold)" />
          <circle cx="28" cy="145" r="2.5" fill="url(#logoGold)" />
          <circle cx="30" cy="62" r="2.5" fill="url(#logoGold)" />
          <circle cx="160" cy="43" r="2.5" fill="url(#logoGold)" />
          <circle cx="172" cy="55" r="2.5" fill="url(#logoGold)" />
          <circle cx="172" cy="145" r="2.5" fill="url(#logoGold)" />
          <circle cx="170" cy="62" r="2.5" fill="url(#logoGold)" />
        </g>
      )}

      <circle cx="100" cy="100" r="52" fill="none" stroke="url(#logoGold)" strokeWidth="7" />
      <text
        x="100"
        y="128"
        textAnchor="middle"
        fontFamily="Georgia, ui-serif, serif"
        fontWeight="700"
        fontSize="80"
        fill="url(#logoGold)"
      >
        X
      </text>
    </svg>
  );
}
