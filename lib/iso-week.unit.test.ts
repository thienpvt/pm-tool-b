import { describe, expect, it } from 'vitest';
import {
  ISO_WEEK_PATTERN,
  formatPeriodDisplayName,
  isoWeekBoundsUtc,
  materializeDueAtUtc,
} from './iso-week';
import { ValidationError } from './services/errors';

describe('ISO_WEEK_PATTERN', () => {
  it('matches YYYY-Wnn shape', () => {
    expect(ISO_WEEK_PATTERN.test('2026-W01')).toBe(true);
    expect(ISO_WEEK_PATTERN.test('2020-W53')).toBe(true);
    expect(ISO_WEEK_PATTERN.test('2026-W1')).toBe(false);
    expect(ISO_WEEK_PATTERN.test('invalid')).toBe(false);
  });
});

describe('isoWeekBoundsUtc', () => {
  it('returns Monday 2025-12-29 through Sunday 2026-01-04 for 2026-W01 (D-02)', () => {
    const bounds = isoWeekBoundsUtc('2026-W01');
    expect(bounds.startDate).toBe('2025-12-29');
    expect(bounds.endDate).toBe('2026-01-04');
  });

  it('handles a W53 year', () => {
    const bounds = isoWeekBoundsUtc('2020-W53');
    expect(bounds.startDate).toBe('2020-12-28');
    expect(bounds.endDate).toBe('2021-01-03');
  });

  it('throws ValidationError for invalid iso_week', () => {
    expect(() => isoWeekBoundsUtc('not-a-week')).toThrow(ValidationError);
  });
});

describe('formatPeriodDisplayName', () => {
  it('returns YYYY-Wnn | start – end with en dash (D-02)', () => {
    expect(formatPeriodDisplayName('2026-W01', '2025-12-29', '2026-01-04')).toBe(
      '2026-W01 | 2025-12-29 – 2026-01-04',
    );
  });
});

describe('materializeDueAtUtc', () => {
  it('returns Friday 2026-01-02 18:00:00 UTC for default due weekday/time (D-03)', () => {
    const dueAt = materializeDueAtUtc('2025-12-29', 5, '18:00:00');
    expect(dueAt.toISOString()).toBe('2026-01-02T18:00:00.000Z');
  });
});
