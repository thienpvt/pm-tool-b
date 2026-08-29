import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeTestPool, hasTestDb, TEST_DATABASE_URL } from '@/test/db';

const SAMPLE_COUNT = 20;
const P95_FAIL_MS = 5000;
const P95_TARGET_MS = 2000;
/** Cached singleton returns in ~0ms; real connect+assert on localhost is typically ≥5ms. */
const WARM_CACHE_THRESHOLD_MS = 1;
const WARM_CACHE_MAX_SAMPLES = 18;

const COLD_START_MD_PATH = resolve(
  __dirname,
  '../.planning/phases/26-rsc-chrome-cold-start/COLD-START.md',
);

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function writeColdStartArtifact(samples: number[], measuredP95: number): void {
  const verdict = measuredP95 <= P95_FAIL_MS ? 'PASS' : 'FAIL';
  const rows = samples
    .map((ms, i) => `| ${i + 1} | ${ms.toFixed(1)} |`)
    .join('\n');

  const body = `# Cold Start Budget (PERF-03)

**Target:** p95 ≤ ${P95_TARGET_MS}ms (local connect + assertMigrated + seedAuthData)
**CI fail threshold:** p95 > ${P95_FAIL_MS}ms
**Measured:** ${new Date().toISOString()}
**Environment:** TEST_DATABASE_URL, vitest node project

## Samples (ms)
| # | connect+assert |
|---|----------------|
${rows}

**p95:** ${measuredP95.toFixed(1)}ms
**Verdict:** ${verdict}
`;

  writeFileSync(COLD_START_MD_PATH, body, 'utf8');
}

function writeSkipColdStartArtifact(): void {
  const body = `# Cold Start Budget (PERF-03)

**Target:** p95 ≤ ${P95_TARGET_MS}ms (local connect + assertMigrated + seedAuthData)
**CI fail threshold:** p95 > ${P95_FAIL_MS}ms
**Measured:** ${new Date().toISOString()}
**Environment:** TEST_DATABASE_URL unset — vitest node project

## Samples (ms)
| # | connect+assert |
|---|----------------|
| — | (no samples — TEST_DATABASE_URL not set) |

**p95:** n/a
**Verdict:** SKIP (no TEST_DATABASE_URL)
`;

  writeFileSync(COLD_START_MD_PATH, body, 'utf8');
}

describe.skipIf(!hasTestDb)('getDb cold start (PERF-03)', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  it(`p95 connect+assert ≤ ${P95_FAIL_MS}ms`, async () => {
    const samples: number[] = [];
    const previousDatabaseUrl = process.env.DATABASE_URL;

    try {
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
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }

    const warmCount = samples.filter((ms) => ms < WARM_CACHE_THRESHOLD_MS).length;
    expect(
      warmCount,
      `warm singleton suspected: ${warmCount}/${SAMPLE_COUNT} samples below ${WARM_CACHE_THRESHOLD_MS}ms — resetModules or pool.end did not clear state`,
    ).toBeLessThan(WARM_CACHE_MAX_SAMPLES);

    const measured = p95(samples);
    expect(measured).toBeLessThan(P95_FAIL_MS);
    writeColdStartArtifact(samples, measured);
  }, 120_000);
});

describe('cold-start source gate (D-05)', () => {
  it('uses getDb/getPool only — no direct Pool construction', () => {
    const source = readFileSync(resolve(__dirname, 'db.cold-start.test.ts'), 'utf8');
    expect(source).not.toMatch(/\bnew\s+Pool\s*\(/);
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).toContain('getDb');
    expect(source).toContain('getPool');
  });
});

describe('COLD-START.md budget artifact (PERF-03)', () => {
  it('records PERF-03 target 2000ms and CI fail threshold 5000ms', () => {
    if (!hasTestDb) {
      writeSkipColdStartArtifact();
    }
    const content = readFileSync(COLD_START_MD_PATH, 'utf8');
    expect(content).toContain('PERF-03');
    expect(content).toContain('2000');
    expect(content).toContain('5000');
  });
});
