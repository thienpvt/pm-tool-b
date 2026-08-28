/** Parse a positive integer route param; rejects NaN, non-integers, and zero/negative. */
export function parsePositiveIntRouteParam(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}
