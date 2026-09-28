import type { SVGProps } from "react";

/** Stroke icons for the Fit module — same 24x24 / currentColor convention
 * as components/shared/Icons.tsx, but a fitness-specific set. */
type P = SVGProps<SVGSVGElement>;

function base({ className, ...rest }: P) {
  return {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
    ...rest,
  };
}

export const HomeI = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const DumbbellI = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
  </svg>
);
export const PlusI = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const ScaleI = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 9a5 5 0 0 1 8 0M12 9l1.5-2" />
  </svg>
);
export const UserI = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
export const FlameI = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-6 5-6 9-1-1-2-2-2-4-2 2-2 4-2 7 0 4 4 7 8 7z" />
  </svg>
);
export const TrophyI = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  </svg>
);
export const CameraI = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
export const PlayI = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 4v16l13-8z" fill="currentColor" />
  </svg>
);
export const ChevronRightI = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const ChevronLeftI = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const ArrowRightI = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ArrowLeftI = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const CheckI = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);
export const ClockI = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const BoltI = (p: P) => (
  <svg {...base(p)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);
export const HeartI = (p: P) => (
  <svg {...base(p)}>
    <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);
export const TargetI = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);
export const DropI = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z" />
  </svg>
);
export const StarI = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
  </svg>
);
export const TrashI = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const PauseI = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 5v14M16 5v14" />
  </svg>
);
export const SwapI = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </svg>
);
export const SparkI = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </svg>
);
export const FileI = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
export const PencilI = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);
export const RunI = (p: P) => (
  <svg {...base(p)}>
    <circle cx="14" cy="4" r="2" />
    <path d="m6 20 3-5 3 2 1-5 3 3h3M9 11l2-3h4l-2 4" />
  </svg>
);
export const LegI = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 3v7l-3 5v6M9 10l6 4v7M6 21h3M15 21h4" />
  </svg>
);
export const SpiralI = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 12a1 1 0 1 1 1-1 3 3 0 1 1-3-3 5 5 0 1 1-5 5 7 7 0 1 1 7 7" />
  </svg>
);
export const SunI = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
  </svg>
);
export const MoonI = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);
export const ExitI = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" />
  </svg>
);
