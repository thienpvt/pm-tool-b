import { describe, expect, it } from 'vitest';
import { resolveCurrentPeriod } from './period-resolver';
import type { WeeklyPeriodRow } from '@/lib/repositories/weekly-periods.repo';

function period(
  id: number,
  start: string,
  end: string,
  display = `P${id}`,
): WeeklyPeriodRow {
  return {
    id,
    company_id: 5,
    iso_week: '2026-W01',
    start_date: start,
    end_date: end,
    due_at: '2026-01-10T18:00:00.000Z',
    display_name: display,
    config_snapshot: { due_weekday: 5, due_time_utc: '18:00:00', obligation_rule_version: 1 },
    created_by: 1,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('resolveCurrentPeriod (D-10)', () => {
  it('prefers the period whose range contains today', () => {
    const periods = [
      period(1, '2026-01-01', '2026-01-07'),
      period(2, '2026-01-08', '2026-01-14', 'Current'),
      period(3, '2026-01-15', '2026-01-21'),
    ];
    expect(resolveCurrentPeriod(periods, '2026-01-10')).toMatchObject({ id: 2, display_name: 'Current' });
  });

  it('falls back to the period with the greatest start_date when today is outside all ranges', () => {
    const periods = [
      period(1, '2026-01-01', '2026-01-07'),
      period(2, '2026-01-08', '2026-01-14'),
    ];
    expect(resolveCurrentPeriod(periods, '2026-02-01')).toMatchObject({ id: 2 });
  });

  it('returns null when there are no periods', () => {
    expect(resolveCurrentPeriod([], '2026-01-10')).toBeNull();
  });
});
