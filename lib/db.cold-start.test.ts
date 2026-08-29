import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeTestPool, hasTestDb, TEST_DATABASE_URL } from '@/test/db';

const SAMPLE_COUNT = 20;
const P95_FAIL_MS = 5000;
/** Cached singleton returns in ~0ms; real connect+assert on localhost is typically ≥5ms. */
const WARM_CACHE_THRESHOLD_MS = 1;
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
    const samples: number[] = [];

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      vi.resetModules();
      process.env.DATABASE_URL = TEST_DATABASE_URL!;
      const t0 = performance.now();
      const { getDb, getPool } = await import('./db');
      await getDb();
      samples.push(performance.now() - t0);
      const pool = await getPool();
      await pool.end();
    }

    const warmCount = samples.filter((ms) => ms < WARM_CACHE_THRESHOLD_MS).length;
    expect(
      warmCount,
      `warm singleton suspected: ${warmCount}/${SAMPLE_COUNT} samples below ${WARM_CACHE_THRESHOLD_MS}ms — resetModules or pool.end did not clear state`,
    ).toBeLessThan(WARM_CACHE_MAX_SAMPLES);

    const measured = p95(samples);
    expect(measured).toBeLessThan(P95_FAIL_MS);
  }, 120_000);
});
