import Link from "next/link";
import { STRETCHES, stretchImages, type Stretch } from "@/lib/fit/stretches";
import { assetPath } from "@/lib/fit/exercise-images";
import { FramesMedia } from "./ui";
import { ClockI } from "./FitIcons";

const BY_ID = new Map(STRETCHES.map((s) => [s.id, s]));

export function getStretches(ids: string[]): Stretch[] {
  return ids.map((id) => BY_ID.get(id)).filter((s): s is Stretch => !!s);
}

export function stretchFrames(s: Stretch): [string, string] {
  const [a, b] = stretchImages(s);
  return [assetPath(a), assetPath(b)];
}

export function totalMinutes(list: Stretch[]): number {
  return Math.max(1, Math.round(list.reduce((a, s) => a + s.seconds + 5, 0) / 60));
}

/** Compact rows with an animated photo, dose and first cue. */
export function StretchList({ items, guidedHref }: { items: Stretch[]; guidedHref?: string }) {
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <details key={s.id} className="group rounded-3xl bg-fit-card-2 p-2">
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <FramesMedia frames={stretchFrames(s)} className="h-16 w-20 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{s.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-fit-accent">
                <ClockI className="h-3 w-3" /> {s.dose}
              </p>
            </div>
          </summary>
          <div className="mt-2 space-y-2 border-t border-fit-line px-1 pt-2 text-xs text-fit-muted">
            <FramesMedia frames={stretchFrames(s)} className="h-44 w-full rounded-2xl" />
            <ul className="space-y-1">
              {s.cues.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>
        </details>
      ))}
      {guidedHref && (
        <Link href={guidedHref} className="mt-2 flex h-12 items-center justify-center rounded-full bg-fit-lime text-sm font-semibold text-fit-on-lime">
          Fazer guiado ({totalMinutes(items)} min)
        </Link>
      )}
    </div>
  );
}

export function toSessionItems(list: Stretch[]) {
  return list.map((s) => ({ id: s.id, name: s.name, dose: s.dose, seconds: s.seconds, cues: s.cues, frames: stretchFrames(s) }));
}
