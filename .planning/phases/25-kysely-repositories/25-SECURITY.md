---
phase: 25
slug: kysely-repositories
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-08-28
---

# Phase 25 — Security

> Repositories query through Kysely on the existing `pg.Pool`. Runtime mass-assignment (`pickAllowed` → `UnknownColumnError` → 400) stays. No second pool. D-23 ops/admin companies unchanged.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Repo write allowlists | Extra JSON keys must not become SQL columns | PATCH body |
| `getKysely()` | Shares `getPool()`; ALS tx instance inside `runInTransactionOnPool` | SQL |
| Admin companies / operations | Session + tenant / `requireAdmin` — not `withCpmo` | JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-25-01 | Tampering | Pool | high | mitigate | Single `pg.Pool`; `PostgresDialect({ pool: getPool() })` | closed |
| T-25-03 | Elevation of Privilege | pickAllowed | critical | mitigate | Unknown keys throw `UnknownColumnError`; `withAuth` → 400 | closed |
| T-25-04 | Tampering | weekly period tx | high | mitigate | `createPeriodWithShells` uses `runInTransaction`; `getKysely` joins ALS | closed |
| T-25-07 | Elevation of Privilege | admin companies | high | mitigate | `getSessionFromRequest` + `requireAdmin`; no `withCpmo` | closed |
| T-25-18 | Elevation of Privilege | tenant columns | critical | mitigate | `PROJECT_COLUMNS` excludes `company_id` | closed |
| T-25-SC | Tampering | npm | high | accept | Only `kysely@0.29.5` + `kysely-codegen@0.20.0` added | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-25-01 | T-25-SC | ENF-02 requires Kysely; pins from D-09 | gsd-security-auditor | 2026-08-28 |

---

## Verdict

**SECURED** — threats_open: 0
