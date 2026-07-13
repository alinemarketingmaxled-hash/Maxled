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
