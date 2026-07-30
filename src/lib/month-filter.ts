/** "YYYY-MM" -> the month's [from, toExclusive) range, for filtering a date
 * column with `{ gte: from, lt: toExclusive }`. Returns null for a
 * missing/malformed value so callers can fall back to "no filter". Plain
 * function (no "use client") so server components can call it directly —
 * MonthFilter.tsx can't export this itself since a "use client" directive
 * marks the whole file, not just the component. */
export function parseMonthParam(value: string | undefined): { from: Date; to: Date } | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) };
}
