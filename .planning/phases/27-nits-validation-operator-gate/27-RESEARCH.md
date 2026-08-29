# Phase 27: Nits, Validation & Operator Gate - Research

**Researched:** 2026-08-29
**Domain:** Process hygiene — audit noise reduction, Nyquist VALIDATION reconciliation, operator gate, budget coexistence documentation
**Confidence:** HIGH

## Summary

Phase 27 is the v2.1 closeout: no new product surfaces, no new npm packages, and no report-route rewrites. Work splits into five tracks aligned with locked decisions D-01..D-06.

**NIT-01** is already satisfied in production code — `listPeriodShells` and `listOpenProjectDependencies` are consumed. The remaining task is a small contract test proving imports still resolve (D-01).

**NIT-02** is the only substantive code change: `updateMilestone` in `milestones.service.ts` unconditionally calls `auditLog` after every successful PATCH. Phase 18 review (IN-01) documented this as audit noise. The fix is to reuse the existing `snapshotsEqual` pattern from `projects.service.ts` — compare `auditSnapshot(prior)` and `auditSnapshot(updated)` and skip `auditLog` when equal (D-02).

**NIT-03** is documentation-only: v1 `budget_items` (project budget screens) coexists with the fiscal ledger (`project_fiscal_budgets`, `/api/portfolio/budgets`). Write `.planning/BUDGET-COEXISTENCE.md` (D-03).

**NYQ-01** requires reconciling two remaining draft VALIDATION files for phases 19–26: Phase 19 (`status: draft`, `nyquist_compliant: false`) and Phase 26 (`status: draft`, `nyquist_compliant: true`). Phases 20–25 are already reconciled (D-05).

**HYG-02** is an operator checkpoint: accept Anthropic malformed-output **502** on the three GET report routes (validation kind escapes `force500`). Record acceptance in `27-HYG-02.md`; no code change unless rejected (D-04).

**Primary recommendation:** TDD the NIT-02 guard in `milestones.service.ts` using the proven `snapshotsEqual` pattern; reconcile VALIDATION frontmatter for phases 19 and 26; document budget coexistence and operator 502 acceptance as artifacts.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| No-op milestone audit skip (NIT-02) | API / Backend | Database / Storage | Service layer owns audit decision before `insertAuditLog`; route is thin wrapper |
| Orphan export contract test (NIT-01) | API / Backend | — | Vitest node contract proves service/repo exports remain imported |
| Budget coexistence doc (NIT-03) | — (docs) | API / Backend | Documentation references both data stores; no UI rewrite |
| VALIDATION.md reconciliation (NYQ-01) | — (planning) | — | Frontmatter + requirement maps only; no runtime |
| Anthropic 502 operator gate (HYG-02) | — (operator) | API / Backend | Status contract already in `lib/api-errors.ts`; confirm monitoring tolerance |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (NIT-01):** Keep the functions. They are already consumed (`listPeriodShells` via weekly-reports.service + dashboards spec; `listOpenProjectDependencies` via repo + tests). Add a small contract test that those consumers still import them. Do not delete.
- **D-02 (NIT-02):** Skip `audit_logs` insert when a milestone PATCH payload is a no-op (before equals after). Keep audits for real field changes.
- **D-03 (NIT-03):** Document coexistence: v1 `budget_items` remains for project budget screens; fiscal ledger is `/portfolio/budget` + fiscal APIs. Do not rewrite budget UI this phase. Write `.planning/BUDGET-COEXISTENCE.md` (or equivalent in phase dir).
- **D-04 (HYG-02):** Operator **accepts** Anthropic malformed-output **502** (vs old 500) for the three report routes. No code change. Record acceptance in CONTEXT + a short `27-HYG-02.md` artifact.
- **D-05 (NYQ-01):** Reconcile remaining draft/`nyquist_compliant: false` VALIDATION.md files for phases 19–26. Do not rewrite archived milestone validation files.
- **D-06:** No new npm. Isolation none. TDD. No visual redesign. Skip UI-SPEC (docs + audit skip, not new chrome). Preserve D-23.

### Claude's Discretion

(none listed in CONTEXT.md — all grey areas auto-accepted at recommended answers)

### Deferred Ideas (OUT OF SCOPE)

None — last phase of v2.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NIT-01 | `listPeriodShells` and `listOpenProjectDependencies` consumed or removed | Already consumed [VERIFIED: grep]; add contract test per D-01 |
| NIT-02 | No-op milestone PATCH does not append audit row | Fix in `milestones.service.ts` using `snapshotsEqual` pattern [VERIFIED: projects.service.ts:44-49,238] |
| NIT-03 | v1 `budget_items` vs fiscal ledger documented | Write `.planning/BUDGET-COEXISTENCE.md` mapping both stores [VERIFIED: budget.repo.ts, PortfolioBudgetPage.tsx] |
| NYQ-01 | Each v2.1 phase has reconciled VALIDATION.md | Reconcile phases 19 and 26 only; 20–25 already done [VERIFIED: frontmatter reads] |
| HYG-02 | Operator confirms Anthropic 502 acceptable for three report routes | Document in `27-HYG-02.md`; routes + `lib/api-errors.ts` already implement split [VERIFIED: CONCERNS.md:25-29] |
</phase_requirements>

## NIT-02: Milestone PATCH → Audit Path (Exact Files)

### Request chain (PATCH)

| Order | File | Role |
|-------|------|------|
| 1 | `app/api/projects/[id]/milestones/[milestoneId]/route.ts` | Thin route: `PUT = withProjectAccess(putMilestonesMilestoneIdHandler, { schema: milestoneUpdateSchema })` |
| 2 | `modules/projects/backend/routes/projects/[id]/milestones/[milestoneId]/handlers.ts` | `putMilestonesMilestoneIdHandler` → calls `updateMilestone` |
| 3 | `modules/projects/backend/routes/projects/[id]/milestones/schema.ts` | `milestoneUpdateSchema` shape guard |
| 4 | **`modules/projects/backend/services/milestones.service.ts`** | **`updateMilestone` — PRIMARY FIX SITE** (lines 55–74): fetches `prior`, updates repo, **unconditionally** `auditLog` |
| 5 | `modules/projects/backend/repositories/milestones.repo.ts` | `updateMilestone` — scoped SQL UPDATE (lines 60–101) |
| 6 | `modules/audit/backend/services/audit.service.ts` | `auditLog` → `insertAuditLog` (line 29–31) |
| 7 | `modules/audit/backend/repositories/audit.repo.ts` | `insertAuditLog` — append-only INSERT into `audit_logs` |

### Test files (NIT-02)

| File | Action |
|------|--------|
| **`modules/projects/backend/services/milestones.service.unit.test.ts`** | Add RED test: identical before/after snapshots → `auditLog` not called; GREEN after guard |
| `app/api/projects/[id]/milestones/[milestoneId]/route.test.ts` | Optional route-level smoke (existing mocks) |

### Pattern reference files (do not duplicate logic)

| File | Pattern |
|------|---------|
| `modules/projects/backend/services/projects.service.ts` | `snapshotsEqual` + `if (!snapshotsEqual(beforeSnap, afterSnap))` before `auditLog` (lines 44–49, 236–248) |
| `modules/documents/backend/services/project-document-checklist.service.ts` | `checklistFieldsDiffer` guard (lines 106–118, 171) |
| `.planning/milestones/v2.0-phases/18-append-only-audit-log/18-REVIEW.md` | IN-01: documents missing diff guard on `updateMilestone` |
| `.planning/milestones/v2.0-phases/18-append-only-audit-log/18-REVIEW-FIX.md` | Delete-audit `result.changes !== 0` precedent |

### `auditSnapshot` fields compared (verbatim scope)

From `milestones.service.ts` lines 15–25 [VERIFIED: modules/projects/backend/services/milestones.service.ts:15-25]:

```typescript
return {
  id: row.id,
  name: row.name,
  status: row.status,
  start_date: row.start_date,
  end_date: row.end_date,
  plan_end: row.plan_end,
};
```

D-02 no-op means `JSON.stringify(beforeSnap) === JSON.stringify(afterSnap)` on these fields (same approach as projects).

## NIT-01: Consumer Map (Exact Files)

| Export | Definition | Consumers (verified) |
|--------|------------|---------------------|
| `listPeriodShells` | `modules/weekly/backend/services/weekly-reports.service.ts:555` | `modules/weekly/backend/services/weekly-reports.service.unit.test.ts`; indirectly via `listPeriodShellsRepo` in `modules/dashboards/backend/services/spec-dashboards.service.ts:17,198` and `modules/weekly/backend/services/weekly-tracking.service.ts:4,190,270,307` |
| `listOpenProjectDependencies` | `modules/projects/backend/repositories/project-dependencies.repo.ts:71` | `modules/projects/backend/repositories/project-dependencies.repo.test.ts:135,160`; exported for Phase 16 dashboard spine |

**Contract test recommendation:** New file e.g. `modules/weekly/backend/services/nit-01-exports.contract.test.ts` or extend an existing gate test — statically import both symbols and assert `typeof fn === 'function'`. No deletion.

## NYQ-01: VALIDATION.md Inventory (Phases 19–26)

| Phase | File | `status` | `nyquist_compliant` | Reconcile? |
|-------|------|----------|----------------------|------------|
| 19 | `.planning/phases/19-data-layer-cutover/19-VALIDATION.md` | `draft` | `false` | **YES** — flip to validated + true after mapping DATA-01..03 to existing `lib/migrate` tests |
| 20 | `.planning/phases/20-api-contract-leftover-routes/20-VALIDATION.md` | `validated` | `true` | No |
| 21 | `.planning/phases/21-portfolio-pm-dashboard-pages/21-VALIDATION.md` | `complete` | `true` | No |
| 22 | `.planning/phases/22-weekly-workflow-surfaces/22-VALIDATION.md` | `validated` | `true` | No |
| 23 | `.planning/phases/23-document-checklist-audit-viewer/23-VALIDATION.md` | `approved` | `true` | No |
| 24 | `.planning/phases/24-repo-wide-module-split/24-VALIDATION.md` | `validated` | `true` | No |
| 25 | `.planning/phases/25-kysely-repositories/25-VALIDATION.md` | `audited` | `true` | No |
| 26 | `.planning/phases/26-rsc-chrome-cold-start/26-VALIDATION.md` | `draft` | `true` | **YES** — flip `status` to `validated`/`audited`; content already Nyquist-compliant (`audited: 2026-08-29` in frontmatter) |

**Out of scope (D-05):** `.planning/milestones/v1.0-phases/*/*-VALIDATION.md` and `.planning/milestones/v2.0-phases/*/*-VALIDATION.md` — do not rewrite.

## HYG-02: Three Report Routes (Exact Files)

Malformed Anthropic output (`IntegrationError` kind `validation`) returns **502** even when route passes `{ force500: true }` [VERIFIED: lib/api-errors.ts:139-150].

| Route | Handler file | `force500` call site |
|-------|--------------|---------------------|
| GET `/api/portfolio/report` | `modules/reports/backend/routes/portfolio/report/route.ts` | line 191 |
| GET `/api/projects/[id]/report` | `modules/reports/backend/routes/projects/[id]/report/handlers.ts` | line 136 |
| GET `/api/projects/[id]/project-report` | `modules/reports/backend/routes/projects/[id]/project-report/handlers.ts` | line 136 |

App re-exports: `app/api/portfolio/report/route.ts`, `app/api/projects/[id]/report/route.ts`, `app/api/projects/[id]/project-report/route.ts`.

Tests documenting the split: `lib/api-errors.test.ts:38-49`, route tests under `app/api/projects/[id]/report/route.test.ts` and `project-report/route.test.ts`.

**Artifact:** `.planning/phases/27-nits-validation-operator-gate/27-HYG-02.md` — operator acceptance record (no code).

## NIT-03: Budget Coexistence (Exact Files)

| Model | Table | Backend | UI / API |
|-------|-------|---------|----------|
| v1 project budget | `budget_items` | `modules/projects/backend/repositories/budget.repo.ts`, `modules/projects/backend/services/budget-items.service.ts` | `app/api/projects/[id]/budget/**` |
| Fiscal ledger (spec) | `project_fiscal_budgets` | portfolio fiscal repos/services | `/api/portfolio/budgets`, `modules/portfolio/ui/budget/PortfolioBudgetPage.tsx` |

Kysely schema registers both: `lib/db/database.ts` includes `budget_items` and fiscal tables [VERIFIED: lib/db/database.ts:16].

**Artifact path (D-03):** `.planning/BUDGET-COEXISTENCE.md`

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` is empty in repo root — no additional project directives beyond AGENTS.md subagent model routing (planner/research use composer-2.5-fast default).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.10 | Unit/contract tests | Existing gate; TDD per D-06 [VERIFIED: package.json:55] |
| (existing) | — | No new packages | D-06 locked |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.4.3 | Route body validation | Already on milestone PATCH schema |
| kysely | 0.29.5 | DB access | Milestone update + audit insert unchanged |

**Installation:** None — D-06 forbids new npm.

## Package Legitimacy Audit

> Skipped — phase installs no external packages (D-06).

## Architecture Patterns

### System Architecture Diagram

```
PATCH /api/projects/:id/milestones/:milestoneId
  → withProjectAccess + milestoneUpdateSchema
  → putMilestonesMilestoneIdHandler
  → updateMilestone (service)
       ├─ assertProjectWriteAccess
       ├─ getMilestoneRepo → prior row
       ├─ updateMilestoneRepo → updated row
       ├─ [NEW] snapshotsEqual(auditSnapshot(prior), auditSnapshot(updated))?
       │     ├─ false → auditLog → insertAuditLog → audit_logs
       │     └─ true  → skip (NIT-02)
       └─ return updated
```

### Pattern 1: Snapshot-equal audit skip

**What:** Compare normalized before/after audit payloads; skip append-only insert on equality.

**When to use:** Any update handler that always runs SQL UPDATE even when values unchanged.

**Example:**

```typescript
// Source: modules/projects/backend/services/projects.service.ts (pattern)
function snapshotsEqual(
  before: ReturnType<typeof auditSnapshot>,
  after: ReturnType<typeof auditSnapshot>,
): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

const beforeSnap = auditSnapshot(prior);
const afterSnap = auditSnapshot(updated);
if (!snapshotsEqual(beforeSnap, afterSnap)) {
  await auditLog({ /* ... */ before: beforeSnap, after: afterSnap });
}
```

### Anti-Patterns to Avoid

- **Skipping repo update on no-op PATCH:** D-02 only skips audit insert; route may still return 200 with unchanged row.
- **Comparing full row objects:** Use `auditSnapshot` fields only — matches Phase 18 audit viewer contract.
- **Rewriting report routes to 500:** Explicitly out of scope (CONTEXT Out list).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep object equality for audit | Custom recursive diff | `JSON.stringify` on `auditSnapshot` payloads | Matches `projects.service.ts` proven pattern |
| New audit table / dual-write | Second log store | Existing `audit_logs` + conditional skip | Phase 18 D-01/D-08 append-only contract |
| Budget unification UI | Redirect/merge screens | Coexistence doc only (D-03) | Avoids data migration scope creep |

## Common Pitfalls

### Pitfall 1: `plan_end` / `end_date` dual-write skew

**What goes wrong:** Repo dual-writes `plan_end` and `end_date` from PATCH body; snapshot comparison might differ if only one field sent.

**Why it happens:** `milestones.repo.ts` lines 66–71 normalize both from body.

**How to avoid:** Test no-op with full milestone fixture where both dates align; compare post-repo `auditSnapshot` outputs.

**Warning signs:** No-op test passes in unit mock but fails in integration with partial body.

### Pitfall 2: Fields outside `auditSnapshot` change silently

**What goes wrong:** `adjusted_end` updates but audited fields identical — audit skipped despite semantic change.

**Why it happens:** `auditSnapshot` omits `adjusted_end` [VERIFIED: milestones.service.ts:15-25].

**How to avoid:** Accept for NIT-02 (matches project/checklist scope); document if CPMO needs `adjusted_end` in audit later.

### Pitfall 3: Reconciling archived milestone VALIDATION files

**What goes wrong:** Planner edits v1.0/v2.0 milestone copies under `.planning/milestones/`.

**How to avoid:** Only touch `.planning/phases/{19..26}-*/{NN}-VALIDATION.md` (D-05).

## Code Examples

### No-op milestone update test (RED skeleton)

```typescript
// modules/projects/backend/services/milestones.service.unit.test.ts
it('updateMilestone skips auditLog when before equals after (NIT-02)', async () => {
  const row = {
    id: 3, name: 'M', status: 'planned',
    start_date: '2026-01-01', end_date: '2026-06-30', plan_end: '2026-06-30',
  };
  getMilestoneRepo.mockResolvedValue(row);
  updateMilestoneRepo.mockResolvedValue(row);
  await updateMilestone(7, owner, 3, { name: 'M' });
  expect(auditLog).not.toHaveBeenCalled();
});
```

### NIT-01 contract import

```typescript
import { listPeriodShells } from '@/modules/weekly/backend/services/weekly-reports.service';
import { listOpenProjectDependencies } from '@/modules/projects/backend/repositories/project-dependencies.repo';

it('NIT-01 exports remain available', () => {
  expect(typeof listPeriodShells).toBe('function');
  expect(typeof listOpenProjectDependencies).toBe('function');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Always audit milestone PATCH | Skip when snapshots equal | Phase 27 (planned) | Reduces CPMO audit viewer noise |
| Anthropic validation → 500 | validation kind → 502 | Phase 20 / INTG-06 | HYG-02 operator confirm only |
| Draft VALIDATION for 19/26 | Reconciled frontmatter | Phase 27 | Closes NYQ-01 for v2.1 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `adjusted_end`-only changes are out of NIT-02 scope | Pitfall 2 | CPMO misses audit for adjusted-end edits |
| A2 | Phase 19 migrate tests fully cover DATA-01..03 for Nyquist flip | NYQ-01 | Reconciliation blocked until test map written |

**If reconciliation depends on VERIFICATION.md:** Phase 19 and 26 both have VERIFICATION.md artifacts — use them when updating VALIDATION frontmatter.

## Open Questions

1. **Phase 19 VALIDATION reconciliation depth**
   - What we know: Phase marked complete 2026-08-28; VALIDATION still `draft`/`false`.
   - What's unclear: Whether `wave_0_complete: false` needs substantive test additions or frontmatter-only update.
   - Recommendation: Read `19-VERIFICATION.md` + existing `lib/migrate/**/*.test.ts`; update requirement→test map then flip frontmatter.

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies; uses existing Vitest + optional `TEST_DATABASE_URL` for repo tests (not required for NIT-02 unit test).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest | ✓ | (project standard) | — |
| vitest | All phase tests | ✓ | 4.1.10 | — |
| TEST_DATABASE_URL | Repo integration tests | optional | — | Unit mocks sufficient for NIT-02 |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run modules/projects/backend/services/milestones.service.unit.test.ts` |
| Full suite command | `npm test` |

Do not use `-x` in plan commands (Vitest 4 ignores it).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NIT-01 | Exports consumed | unit/contract | `npx vitest run modules/weekly/backend/services/nit-01-exports.contract.test.ts` | ❌ Wave 0 |
| NIT-02 | No-op PATCH skips audit | unit | `npx vitest run modules/projects/backend/services/milestones.service.unit.test.ts` | ✅ (extend) |
| NIT-03 | Budget doc exists | manual/doc | file check `.planning/BUDGET-COEXISTENCE.md` | ❌ Wave 0 |
| NYQ-01 | VALIDATION reconciled | manual | grep frontmatter phases 19,26 | ✅ files exist |
| HYG-02 | Operator artifact | manual | file check `27-HYG-02.md` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Targeted vitest on task test files
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] NIT-01 contract test file
- [ ] NIT-02 no-op skip test in milestones.service.unit.test.ts
- [ ] `.planning/BUDGET-COEXISTENCE.md`
- [ ] `27-HYG-02.md` operator record
- [ ] Phase 19 + 26 VALIDATION frontmatter reconciliation

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | unchanged |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes | Existing `assertProjectWriteAccess` on milestone PATCH |
| V5 Input Validation | yes | `milestoneUpdateSchema` on route |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Audit trail tampering | Tampering | Append-only `audit_logs`; skip insert ≠ delete |
| Cross-tenant milestone PATCH | Elevation | Scoped repo `where project_id` + access assert |

NIT-02 reduces noise only — does not weaken tenancy or immutability.

## Sources

### Primary (HIGH confidence)

- Codebase reads: `milestones.service.ts`, `projects.service.ts`, `api-errors.ts`, VALIDATION frontmatter (this session)
- `.planning/phases/27-nits-validation-operator-gate/27-CONTEXT.md` — locked decisions
- `.planning/codebase/CONCERNS.md:25-29` — HYG-02 status split

### Secondary (MEDIUM confidence)

- `.planning/milestones/v2.0-phases/18-append-only-audit-log/18-REVIEW.md` — IN-01 finding

### Tertiary (LOW confidence)

- None material — implementation paths verified in repo

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; Vitest version confirmed in package.json
- Architecture: HIGH — exact file chain traced for NIT-02
- Pitfalls: MEDIUM — `adjusted_end` scope assumption (A1)

**Research date:** 2026-08-29
**Valid until:** 2026-09-28 (stable hygiene phase)
