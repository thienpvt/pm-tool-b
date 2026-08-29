# Cold Start Budget (PERF-03)

**Target:** p95 ≤ 2000ms (local connect + assertMigrated + seedAuthData)
**CI fail threshold:** p95 > 5000ms
**Measured:** 2026-08-29T02:22:14.295Z
**Environment:** TEST_DATABASE_URL, vitest node project

## Samples (ms)
| # | connect+assert |
|---|----------------|
| 1 | 133.7 |
| 2 | 6.8 |
| 3 | 5.5 |
| 4 | 5.2 |
| 5 | 5.2 |
| 6 | 4.9 |
| 7 | 5.2 |
| 8 | 5.3 |
| 9 | 5.3 |
| 10 | 5.2 |
| 11 | 5.2 |
| 12 | 5.3 |
| 13 | 5.1 |
| 14 | 5.3 |
| 15 | 5.1 |
| 16 | 5.0 |
| 17 | 5.1 |
| 18 | 4.9 |
| 19 | 5.4 |
| 20 | 4.7 |

**p95:** 6.8ms
**Verdict:** PASS
