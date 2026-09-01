/** Adds N business days (Mon–Fri) to a date. Holiday calendars are a future config addition (see docs/CRM-SPEC.md §3.4). */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

/** Business days (Mon–Fri) remaining between now and a deadline — used by
 * the "A caminho" countdown chip/badge, which is denominated in business
 * days (the same unit addBusinessDays used to set the deadline in the first
 * place). Zero or negative means the deadline is today or already past. */
export function businessDaysRemaining(deadline: Date, from: Date = new Date()): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(0, 0, 0, 0);
  const sign = end >= cursor ? 1 : -1;
  while (cursor.getTime() !== end.getTime()) {
    cursor.setDate(cursor.getDate() + sign);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += sign;
  }
  return count;
}
