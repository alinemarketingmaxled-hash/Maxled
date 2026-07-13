export function PlaceholderModule({
  title,
  subtitle,
  note,
}: {
  title: string;
  subtitle: string;
  note: string;
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">{title}</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-dashed border-gold-deep/50 bg-surface px-6 py-10 text-center">
        <p className="text-sm text-ink-muted">{note}</p>
      </div>
    </div>
  );
}
