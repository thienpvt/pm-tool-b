import { describe, expect, it } from 'vitest';
import { DONE_STATUSES, statusPct, statusWeight, weightedProgress } from './status-weights';

describe('statusWeight', () => {
  it('returns the mapped weight for a known status', () => {
    expect(statusWeight('Done')).toBe(1);
    expect(statusWeight('In Progress')).toBe(0.3);
    expect(statusWeight('Re-Open')).toBe(0.7);
  });

  it('returns 0 for unknown, null, undefined, and empty status', () => {
    expect(statusWeight('Not A Status')).toBe(0);
    expect(statusWeight(null)).toBe(0);
    expect(statusWeight(undefined)).toBe(0);
    expect(statusWeight('')).toBe(0);
  });
});

describe('statusPct', () => {
  it('converts weight to a rounded percentage', () => {
    expect(statusPct('Done')).toBe(100);
    expect(statusPct('In Progress')).toBe(30);
    expect(statusPct('New')).toBe(0);
    expect(statusPct(undefined)).toBe(0);
  });
});

describe('DONE_STATUSES', () => {
  it('includes only statuses weighted >= 1', () => {
    expect(DONE_STATUSES).toContain('Done');
    expect(DONE_STATUSES).toContain('UAT');
    expect(DONE_STATUSES).not.toContain('In Testing');
    expect(DONE_STATUSES.every((s) => statusWeight(s) >= 1)).toBe(true);
  });
});

describe('weightedProgress', () => {
  it('returns 0 for an empty list', () => {
    expect(weightedProgress([])).toBe(0);
  });

  it('returns 100 when every status is done', () => {
    expect(weightedProgress(['Done', 'Deployed', 'UAT'])).toBe(100);
  });

  it('averages weights across the list and rounds', () => {
    // 1 + 0.3 = 1.3 / 2 = 0.65 -> 65
    expect(weightedProgress(['Done', 'In Progress'])).toBe(65);
    // 0.1 + 0.2 + 0.3 = 0.6 / 3 = 0.2 -> 20
    expect(weightedProgress(['To Do', 'In Dev', 'In Progress'])).toBe(20);
  });

  it('counts unknown and nullish statuses as 0 weight, not as absent', () => {
    expect(weightedProgress(['Done', 'Bogus Status'])).toBe(50);
    expect(weightedProgress(['Done', null, undefined])).toBe(33);
  });
});
