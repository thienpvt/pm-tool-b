# Cold Start Budget (PERF-03)

**Target:** p95 ≤ 2000ms (local connect + assertMigrated + seedAuthData)
**CI fail threshold:** p95 > 5000ms
**Measured:** 2026-08-29T02:28:54.335Z
**Environment:** TEST_DATABASE_URL, vitest node project

## Samples (ms)
| # | connect+assert |
|---|----------------|
| 1 | 144.7 |
| 2 | 6.9 |
| 3 | 5.8 |
| 4 | 5.3 |
| 5 | 5.6 |
| 6 | 5.4 |
| 7 | 5.2 |
| 8 | 5.0 |
| 9 | 5.7 |
| 10 | 5.4 |
| 11 | 5.1 |
| 12 | 7.0 |
| 13 | 5.3 |
| 14 | 5.4 |
| 15 | 5.3 |
| 16 | 5.7 |
| 17 | 5.5 |
| 18 | 5.1 |
| 19 | 5.3 |
| 20 | 5.3 |

**p95:** 7.0ms
**Verdict:** PASS
