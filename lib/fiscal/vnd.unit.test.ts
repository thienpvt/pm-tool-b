import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/services/errors';
import { coerceVndSafe, parseNonNegativeVnd, parseSignedNonZeroVnd } from './vnd';

describe('coerceVndSafe', () => {
  it('coerces string and numeric safe integers', () => {
    expect(coerceVndSafe('1000000')).toBe(1_000_000);
    expect(coerceVndSafe(500)).toBe(500);
  });

  it('rejects values outside Number.isSafeInteger range', () => {
    const unsafe = String(Number.MAX_SAFE_INTEGER + 1);
    expect(() => coerceVndSafe(unsafe, 'approved_amount_vnd')).toThrow(ValidationError);
    expect(() => coerceVndSafe(Number.MAX_SAFE_INTEGER + 1, 'amount_vnd')).toThrow(ValidationError);
  });
});

describe('parseNonNegativeVnd', () => {
  it('accepts 0 and 1000000', () => {
    expect(parseNonNegativeVnd(0, 'amount')).toBe(0);
    expect(parseNonNegativeVnd(1000000, 'amount')).toBe(1000000);
  });

  it('rejects 1.5, -1, empty string, and non-safe integers', () => {
    expect(() => parseNonNegativeVnd(1.5, 'amount')).toThrow(ValidationError);
    expect(() => parseNonNegativeVnd(-1, 'amount')).toThrow(ValidationError);
    expect(() => parseNonNegativeVnd('', 'amount')).toThrow(ValidationError);
    expect(() => parseNonNegativeVnd(Number.MAX_SAFE_INTEGER + 1, 'amount')).toThrow(ValidationError);
  });
});

describe('parseSignedNonZeroVnd', () => {
  it('accepts positive and negative non-zero integers', () => {
    expect(parseSignedNonZeroVnd(500, 'amount')).toBe(500);
    expect(parseSignedNonZeroVnd(-500, 'amount')).toBe(-500);
  });

  it('rejects 0 and non-integers', () => {
    expect(() => parseSignedNonZeroVnd(0, 'amount')).toThrow(ValidationError);
    expect(() => parseSignedNonZeroVnd(1.5, 'amount')).toThrow(ValidationError);
  });
});
