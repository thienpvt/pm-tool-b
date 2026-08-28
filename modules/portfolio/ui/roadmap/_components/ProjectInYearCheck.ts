import type { ProjectRow } from '../types';

export function projectInYear(p: ProjectRow, year: number): boolean {
  const yStart = new Date(year, 0, 1).getTime();
  const yEnd   = new Date(year, 11, 31, 23, 59, 59).getTime();

  if (p.start_date || p.end_date) {
    const s = p.start_date ? new Date(p.start_date + 'T00:00:00').getTime() : -Infinity;
    const e = p.end_date   ? new Date(p.end_date   + 'T23:59:59').getTime() :  Infinity;
    return s <= yEnd && e >= yStart;
  }

  // Fall back to min/max of phase activity dates
  const times: number[] = [];
  for (const ph of p.phases) {
    if (ph.start_date) times.push(new Date(ph.start_date + 'T00:00:00').getTime());
    if (ph.end_date)   times.push(new Date(ph.end_date   + 'T23:59:59').getTime());
  }
  if (!times.length) return false;
  return Math.min(...times) <= yEnd && Math.max(...times) >= yStart;
}
