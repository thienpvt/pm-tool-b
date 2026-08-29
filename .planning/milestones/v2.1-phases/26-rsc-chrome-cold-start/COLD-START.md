# Cold Start Budget (PERF-03)

**Target:** p95 ≤ 2000ms (local connect + assertMigrated + seedAuthData)
**CI fail threshold:** p95 > 5000ms
**Measured:** 2026-08-29T06:21:20.135Z
**Environment:** TEST_DATABASE_URL unset — vitest node project

## Samples (ms)
| # | connect+assert |
|---|----------------|
| — | (no samples — TEST_DATABASE_URL not set) |

**p95:** n/a
**Verdict:** SKIP (no TEST_DATABASE_URL)
