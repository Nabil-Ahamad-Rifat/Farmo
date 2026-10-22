import { farmToday } from '@farm/business-logic';

/**
 * A day from a form ("YYYY-MM-DD") as stored (noon UTC), checked not to be in
 * the future on the farm's clock. Missing means today; `keep` is returned
 * instead when given (edits that don't change the date).
 */
export function entryDay(raw: unknown, keep?: Date): { date: Date } | { error: string } {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: keep ?? new Date(farmToday() + 'T12:00:00Z') };
  if (raw > farmToday()) return { error: 'The date cannot be in the future' };
  return { date: new Date(raw + 'T12:00:00Z') };
}
