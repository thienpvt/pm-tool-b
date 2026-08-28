import { ValidationError } from '@/lib/services/errors';

export function parseIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} must be YYYY-MM-DD`, field);
  }
  return value;
}
