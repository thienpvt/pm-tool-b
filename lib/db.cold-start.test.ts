import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeTestPool, hasTestDb, TEST_DATABASE_URL } from '@/test/db';

const SAMPLE_COUNT = 20;
const P95_FAIL_MS = 5000;
const WARM_CACHE_THRESHOLD_MS = 50;
const WARM_CACHE_MAX_SAMPLES = 18;

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe.skipIf(!hasTestDb)('getDb cold start (PERF-03)', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  it(`p95 connect+assert ≤ ${P95_FAIL_MS}ms`, async () => {
    // RED: loop, warm-cache guard, and teardown not implemented yet
    expect.fail('cold-start measurement loop not implemented');
  }, 120_000);
});
