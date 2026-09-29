import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { exerciseImages } from "@/lib/fit/exercise-images";
import { POSES, type Pose } from "@/lib/fit/poses";
import type { Pattern } from "@/lib/fit/exercises";
import { ArrowLeftI, BoltI, DumbbellI, HeartI, LegI, SpiralI, TargetI } from "./FitIcons";

export function Card({
  children,
  className = "",
  tone = "card",
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: "card" | "lime" | "strong";
  /** Drop the default padding (for edge-to-edge content). */
  flush?: boolean;
}) {
  const bg =
    tone === "lime" ? "bg-fit-lime text-fit-on-lime" : tone === "strong" ? "bg-fit-strong text-white" : "bg-fit-card text-fit-ink";
  return <section className={`rounded-[28px] ${flush ? "" : "p-5"} ${bg} ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function SeeAll({ href, children = "Ver tudo" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-fit-accent hover:underline">
      {children}
    </Link>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      {back && (
        <Link
          href={back}
          aria-label="Voltar"
          className="absolute left-0 grid h-9 w-9 place-items-center rounded-full bg-fit-strong text-white"
        >
          <ArrowLeftI className="h-4 w-4" />
        </Link>
      )}
      <h1 className="text-[15px] font-semibold">{title}</h1>
      {right && <div className="absolute right-0">{right}</div>}
    </header>
  );
}

export function Pill({ active, children, onClick, className = "" }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
        active ? "bg-fit-lime text-fit-on-lime" : "bg-fit-card-2 text-fit-muted hover:text-fit-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, unit, tone }: { label: string; value: ReactNode; unit?: string; tone?: "lime" }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-fit-muted">{label}</p>
      <p className={`truncate text-lg font-bold tabular-nums ${tone === "lime" ? "text-fit-accent" : ""}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-fit-muted">{unit}</span>}
      </p>
    </div>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-fit-card-3 ${className}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-fit-lime transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Concentric activity rings, like the "Daily Activity" card of the design. */
export function Rings({ values, size = 132 }: { values: number[]; size?: number }) {
  const stroke = 11;
  const gap = 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      {values.map((v, i) => {
        const r = size / 2 - stroke / 2 - i * (stroke + gap);
        if (r <= stroke) return null;
        const c = 2 * Math.PI * r;
        const pct = Math.max(0, Math.min(1, v));
        return (
          <g key={i}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fit-card-3)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--fit-lime)"
              strokeOpacity={1 - i * 0.22}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c * pct} ${c}`}
              className="transition-[stroke-dasharray] duration-700"
            />
          </g>
        );
      })}
    </svg>
  );
}

const PATTERN_ICON: Partial<Record<Pattern, typeof DumbbellI>> = {
  agachar: LegI,
  unilateral_perna: LegI,
  dobrar_quadril: LegI,
  isolado_perna: LegI,
  core: TargetI,
  condicionamento: BoltI,
  mobilidade: SpiralI,
};

/** Stand-in "photo" for an exercise: gradient tile with a pattern glyph. */
export function ExerciseArt({ pattern, size = "md", label }: { pattern: Pattern; size?: "sm" | "md" | "lg"; label?: string }) {
  const Icon = PATTERN_ICON[pattern] ?? (pattern === "condicionamento" ? HeartI : DumbbellI);
  const dims = size === "sm" ? "h-14 w-14 rounded-2xl" : size === "lg" ? "h-44 w-full rounded-[28px]" : "h-24 w-full rounded-3xl";
  return (
    <div
      className={`relative grid shrink-0 overflow-hidden ${size === "lg" ? "items-start justify-items-end p-6" : "place-items-center"} ${dims}`}
      style={{
        background:
          "radial-gradient(120% 90% at 20% 10%, color-mix(in srgb, var(--fit-lime) 38%, transparent), transparent 60%), linear-gradient(160deg, var(--fit-card-3), var(--fit-strong))",
      }}
    >
      <Icon className={size === "sm" ? "h-6 w-6 text-fit-lime" : size === "lg" ? "h-16 w-16 rotate-[-20deg] text-fit-lime/70" : "h-10 w-10 text-fit-lime"} />
      {label && <span className="absolute bottom-2 left-3 text-[11px] font-semibold text-white/80">{label}</span>}
    </div>
  );
}

export function LineChart({
  points,
  height = 120,
  unit = "",
  goal,
}: {
  points: { x: string; y: number }[];
  height?: number;
  unit?: string;
  goal?: number | null;
}) {
  if (points.length === 0) return <p className="py-6 text-center text-xs text-fit-muted">Sem dados ainda.</p>;
  const w = 320;
  const pad = { l: 24, r: 24, t: 16, b: 22 };
  const ys = points.map((p) => p.y).concat(goal != null ? [goal] : []);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max - min < 1) {
    min -= 1;
    max += 1;
  }
  const sx = (i: number) => pad.l + (points.length === 1 ? (w - pad.l - pad.r) / 2 : (i * (w - pad.l - pad.r)) / (points.length - 1));
  const sy = (v: number) => pad.t + ((max - v) * (height - pad.t - pad.b)) / (max - min);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${sx(points.length - 1)},${height - pad.b} L${sx(0)},${height - pad.b} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label={`Evolução: ${points.map((p) => `${p.x} ${p.y}${unit}`).join(", ")}`}>
      <defs>
        <linearGradient id="fitArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--fit-lime)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--fit-lime)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {goal != null && (
        <>
          <line x1={pad.l} x2={w - pad.r} y1={sy(goal)} y2={sy(goal)} stroke="var(--fit-muted)" strokeDasharray="4 4" strokeWidth="1" />
          <text x={w - pad.r} y={sy(goal) - 4} textAnchor="end" fontSize="9" fill="var(--fit-muted)">
            meta {fmtNum(goal)}
            {unit}
          </text>
        </>
      )}
      {points.length > 1 && <path d={area} fill="url(#fitArea)" />}
      {points.length > 1 && <path d={d} fill="none" stroke="var(--fit-lime)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(p.y)} r="4" fill="var(--fit-bg)" stroke="var(--fit-lime)" strokeWidth="2" />
          {(i === points.length - 1 || points.length <= 6) && (
            <text x={sx(i)} y={sy(p.y) - 8} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--fit-ink)">
              {fmtNum(p.y)}
            </text>
          )}
          {(points.length <= 6 || i === 0 || i === points.length - 1) && (
            <text
              x={sx(i)}
              y={height - 6}
              textAnchor={points.length > 1 && i === 0 ? "start" : points.length > 1 && i === points.length - 1 ? "end" : "middle"}
              dx={points.length > 1 && i === 0 ? -pad.l + 2 : points.length > 1 && i === points.length - 1 ? pad.r - 2 : 0}
              fontSize="9"
              fill="var(--fit-muted)"
            >
              {p.x}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).replace(".", "");
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null) return "–";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

export function signed(n: number | null | undefined, unit = ""): string {
  if (n == null) return "–";
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${fmtNum(Math.abs(n))}${unit}`;
}

/** Real execution photo when we have one (animated start ↔ end), otherwise
 * the illustrated tile. `animate` is off for small thumbnails in long
 * lists so the page doesn't turn into a wall of motion. */
export function ExerciseMedia({
  id,
  pattern,
  size = "md",
  animate = size !== "sm",
  labels = false,
  className = "",
}: {
  id: string;
  pattern: Pattern;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  labels?: boolean;
  className?: string;
}) {
  const img = exerciseImages(id);
  const pose = POSES[id];
  if (!img && pose) return <PoseMedia poses={pose} size={size} animate={animate} labels={labels} className={className} />;
  if (!img) return <ExerciseArt pattern={pattern} size={size} />;
  const dims = size === "sm" ? "h-14 w-14 rounded-2xl" : size === "lg" ? "h-56 w-full rounded-[28px]" : "h-28 w-full rounded-3xl";
  const sizes = size === "sm" ? "56px" : "(max-width: 448px) 100vw, 448px";
  return (
    <div className={`relative shrink-0 overflow-hidden bg-white ${dims} ${className}`}>
      <Image src={img.frames[0]} alt="" fill sizes={sizes} unoptimized className="object-cover" />
      {animate && <Image src={img.frames[1]} alt="" fill sizes={sizes} unoptimized className="fit-demo-end object-cover" />}
      {labels && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-[10px] font-semibold text-white">
          <span>{animate ? "Início ↔ fim do movimento" : "Posição inicial"}</span>
          {img.approx && <span className="rounded-full bg-black/50 px-2 py-0.5 font-normal">movimento de referência</span>}
        </div>
      )}
    </div>
  );
}

/** One illustrated frame of a pose (see lib/fit/poses.ts). */
export function PoseFrame({ pose, className = "" }: { pose: Pose; className?: string }) {
  const seg = (a: [number, number], b: [number, number], c?: [number, number]) =>
    `M${a[0]},${a[1]} L${b[0]},${b[1]}${c ? ` L${c[0]},${c[1]}` : ""}`;
  return (
    <svg viewBox="0 0 200 130" className={className} role="img" aria-hidden>
      <line x1="4" x2="196" y1="119" y2="119" stroke="var(--fit-lime)" strokeOpacity="0.35" strokeWidth="2" />
      {pose.props?.map((p, i) =>
        "dot" in p ? (
          <circle key={i} cx={p.dot[0]} cy={p.dot[1]} r="5" fill="var(--fit-lime)" />
        ) : (
          <line
            key={i}
            x1={p.line[0][0]}
            y1={p.line[0][1]}
            x2={p.line[1][0]}
            y2={p.line[1][1]}
            stroke={p.wall ? "#6c6d73" : "var(--fit-lime)"}
            strokeWidth={p.wall ? 4 : 3}
            strokeLinecap="round"
          />
        ),
      )}
      <g fill="none" stroke="#f4f5f0" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        {/* far-side limbs slightly dimmer for depth */}
        <path d={seg(pose.hip, pose.kneeR, pose.footR)} strokeOpacity="0.55" />
        <path d={seg(pose.neck, pose.elbowR, pose.handR)} strokeOpacity="0.55" />
        <path d={seg(pose.neck, pose.hip)} strokeWidth="9" />
        <path d={seg(pose.hip, pose.kneeL, pose.footL)} />
        <path d={seg(pose.neck, pose.elbowL, pose.handL)} />
      </g>
      <circle cx={pose.head[0]} cy={pose.head[1]} r="9" fill="#f4f5f0" />
    </svg>
  );
}

function PoseMedia({
  poses,
  size,
  animate,
  labels,
  className,
}: {
  poses: [Pose, Pose];
  size: "sm" | "md" | "lg";
  animate: boolean;
  labels: boolean;
  className: string;
}) {
  const dims = size === "sm" ? "h-14 w-14 rounded-2xl" : size === "lg" ? "h-56 w-full rounded-[28px]" : "h-28 w-full rounded-3xl";
  return (
    <div className={`relative shrink-0 overflow-hidden bg-[#1f2024] ${dims} ${className}`}>
      <PoseFrame pose={poses[0]} className="absolute inset-0 h-full w-full" />
      {animate && (
        <div className="fit-demo-end absolute inset-0 bg-[#1f2024]">
          <PoseFrame pose={poses[1]} className="h-full w-full" />
        </div>
      )}
      {labels && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2 text-[10px] font-semibold text-white/80">
          {animate ? "Início ↔ fim do movimento" : "Posição inicial"} · ilustração
        </div>
      )}
    </div>
  );
}

/** Start/end photo pair cross-faded into the movement (same effect as
 * ExerciseMedia), for any two frames. */
export function FramesMedia({ frames, className = "", animate = true }: { frames: [string, string]; className?: string; animate?: boolean }) {
  return (
    <div className={`relative shrink-0 overflow-hidden bg-white ${className}`}>
      <Image src={frames[0]} alt="" fill sizes="(max-width: 448px) 100vw, 448px" unoptimized className="object-cover" />
      {animate && <Image src={frames[1]} alt="" fill sizes="(max-width: 448px) 100vw, 448px" unoptimized className="fit-demo-end object-cover" />}
    </div>
  );
}
