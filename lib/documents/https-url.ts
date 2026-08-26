import { ValidationError } from '@/lib/services/errors';

export function parseHttpsUrl(
  value: unknown,
  field: string,
  opts?: { allowEmpty?: boolean },
): string | null {
  if (value === null || value === undefined || value === '') {
    if (opts?.allowEmpty) return null;
    throw new ValidationError(`${field} is required`, field);
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`, field);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (opts?.allowEmpty) return null;
    throw new ValidationError(`${field} is required`, field);
  }
  if (trimmed.startsWith('data:')) {
    throw new ValidationError(`${field} must use https://`, field);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError(`${field} must use https://`, field);
  }
  if (parsed.protocol !== 'https:') {
    throw new ValidationError(`${field} must use https://`, field);
  }
  return trimmed;
}
