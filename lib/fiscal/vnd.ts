import { ValidationError } from '@/lib/services/errors';

export function parseNonNegativeVnd(value: unknown, field: string): number {
  const n = typeof value === 'string' && value !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`, field);
  }
  return n;
}

export function coerceVndSafe(value: string | number, field = 'amount_vnd'): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new ValidationError(`${field} exceeds safe integer range`, field);
  }
  return n;
}

export function parseSignedNonZeroVnd(value: unknown, field: string): number {
  const n = typeof value === 'string' && value !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n === 0) {
    throw new ValidationError(`${field} must be a non-zero integer`, field);
  }
  return n;
}

export function parseFiscalYear(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1900 || n > 2100) {
    throw new ValidationError('fiscal_year must be an integer between 1900 and 2100', 'fiscal_year');
  }
  return n;
}

export type CostType = 'CAPEX' | 'OPEX';

export function parseCostType(value: unknown): CostType {
  if (value !== 'CAPEX' && value !== 'OPEX') {
    throw new ValidationError('cost_type must be CAPEX or OPEX', 'cost_type');
  }
  return value;
}
