/** Calendar helpers pinned to Brazil time. The server runs in UTC, so a
 * workout logged at 22h in São Paulo would otherwise land on the next day. */
export const FIT_TZ = "America/Sao_Paulo";

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: FIT_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: FIT_TZ, weekday: "short" });
const WD: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** "YYYY-MM-DD" in Brazil time. */
export function dayKey(d: Date | string = new Date()): string {
  return keyFmt.format(typeof d === "string" ? new Date(d) : d);
}

/** Weekday with Monday = 0, in Brazil time. */
export function weekdayIndex(d: Date | string = new Date()): number {
  return WD[wdFmt.format(typeof d === "string" ? new Date(d) : d)] ?? 0;
}

/** Shifts a "YYYY-MM-DD" key by whole days. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Key of this week's Monday. */
export function mondayKey(d: Date = new Date()): string {
  return addDays(dayKey(d), -weekdayIndex(d));
}
