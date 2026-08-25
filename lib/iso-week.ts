import { ValidationError } from './services/errors';

export const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;

export type IsoWeekBounds = {
  startDate: string;
  endDate: string;
};

function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoWeek(isoWeek: string): { year: number; week: number } {
  if (!ISO_WEEK_PATTERN.test(isoWeek)) {
    throw new ValidationError('Invalid iso_week format', 'iso_week');
  }
  const year = parseInt(isoWeek.slice(0, 4), 10);
  const week = parseInt(isoWeek.slice(6, 8), 10);
  if (week < 1 || week > 53) {
    throw new ValidationError('Invalid iso_week week number', 'iso_week');
  }
  return { year, week };
}

/** UTC ISO week bounds using the Thursday rule (Monday 00:00 – Sunday). */
export function isoWeekBoundsUtc(isoWeek: string): IsoWeekBounds {
  const { year, week } = parseIsoWeek(isoWeek);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(Date.UTC(year, 0, 4 - (jan4Day - 1)));
  const monday = new Date(mondayWeek1.getTime() + (week - 1) * 7 * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { startDate: formatUtcDate(monday), endDate: formatUtcDate(sunday) };
}

export function formatPeriodDisplayName(
  isoWeek: string,
  startDate: string,
  endDate: string,
): string {
  return `${isoWeek} | ${startDate} – ${endDate}`;
}

/** Materialize due_at for a weekday (0=Sun … 6=Sat) and time within the week starting startDate (Monday). */
export function materializeDueAtUtc(
  startDate: string,
  dueWeekday: number,
  dueTimeUtc: string,
): Date {
  const [y, m, d] = startDate.split('-').map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d));
  const mondayIndex = 1;
  const sundayIndex = 0;
  const targetIndex = dueWeekday === sundayIndex ? 7 : dueWeekday;
  const offset = targetIndex - mondayIndex;
  const dueDate = new Date(monday.getTime() + offset * 86_400_000);
  const [hh, mm, ss = '0'] = dueTimeUtc.split(':');
  dueDate.setUTCHours(parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10), 0);
  return dueDate;
}
