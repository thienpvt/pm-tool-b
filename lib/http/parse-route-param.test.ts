import { describe, expect, it } from 'vitest';
import { parsePositiveIntRouteParam } from './parse-route-param';

describe('parsePositiveIntRouteParam', () => {
  it('accepts positive integer strings', () => {
    expect(parsePositiveIntRouteParam('12')).toBe(12);
  });

  it('rejects non-numeric values', () => {
    expect(parsePositiveIntRouteParam('abc')).toBeNull();
  });

  it('rejects zero and negative values', () => {
    expect(parsePositiveIntRouteParam('0')).toBeNull();
    expect(parsePositiveIntRouteParam('-1')).toBeNull();
  });
});
