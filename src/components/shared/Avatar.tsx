/** Small circular initials avatar — same visual pattern used for post
 * authors in Comunicados (see PostFeed.tsx's local Avatar), generalized
 * here for reuse anywhere a name needs a compact avatar. */
export function Avatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "xs" | "sm" | "md";
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const dims = size === "xs" ? "h-5 w-5" : size === "md" ? "h-9 w-9" : "h-6 w-6";
  const textSize = size === "xs" ? "text-[8.5px]" : size === "md" ? "text-[10.5px]" : "text-[9px]";

  return (
    <div
      aria-hidden="true"
      className={`flex ${dims} flex-none items-center justify-center rounded-full border border-gold-deep bg-surface-3 ${textSize} font-bold text-gold-bright`}
    >
      {initials}
    </div>
  );
}
