// Pure leave-calculation helpers — no Prisma / no side effects.

/**
 * Count inclusive working days between two dates (Mon–Fri; weekends and the
 * given holidays are skipped). Returns at least 0.5 (minimum half-day).
 */
export function workingDays(from: Date, to: Date, holidays: Date[]): number {
  let count = 0;
  const holidaySet = new Set(holidays.map((h) => h.toISOString().slice(0, 10)));
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const key = cursor.toISOString().slice(0, 10);
    if (!isWeekend && !holidaySet.has(key)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(count, 0.5);
}
