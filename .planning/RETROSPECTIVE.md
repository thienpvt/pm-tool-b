# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Layer Reorg & Hardening

**Shipped:** 2026-08-25
**Phases:** 8 | **Plans:** 35 | **Tasks:** 80

### What Was Built
- Vitest harness and layer tests (727 passing)
- Repositories with allowlists; services with tenant asserts; thin routes behind `withAuth` / `withProjectAccess`
- Jira / Anthropic / Resend clients + unified credential resolver; INTG-08 cutover after evidence
- Access wrappers rolled out on project-scoped paths; two live IDORs closed
- Seven god pages split into hooks + modules

### What Worked
- Bottom-up phase order (tests → repos → clients → services → wrappers → enforcement → UI → cutover)
- HYG-01 dedicated deletion commit for dead credential helpers after a read-only evidence script
- Accepting vacuous zero-row cutover evidence locally while keeping the script for production re-run

### What Was Inefficient
- INTG-08 deferred from Phase 3, then a whole Phase 8 to finish a gated delete
- Nyquist VALIDATION.md files stayed `draft` (never `$gsd-validate-phase`)
- Some SUMMARY YAML missing `requirements-completed`, forcing 3-source audit manual work

### Patterns Established
- Evidence-gated HYG-01 deletions (`npx tsx --env-file=.env.local` on Windows)
- `withProjectAccess` as the project-scoped route shape
- God-page split: named hook + `_components` + jsdom tests

### Key Lessons
1. Do not delete dual-path credentials without a tenant-match script — the live resolver can be correct while dead helpers remain.
2. Stale VERIFICATION body tables (SVC-01 BLOCKED) confuse audits; keep frontmatter and body in sync.
3. Non-core admin/ops routes will lag the service layer unless they are explicitly in a phase, not "remainder."

### Cost Observations
- Model mix: Grok 4.6 for plan/check; Composer 2.5 for research/execute/verify
- Notable: Phase 8 was a one-plan execute after a full discuss→plan loop for a deletion + script run

---

## Milestone: v2.0 — Portfolio One View

**Shipped:** 2026-08-26
**Phases:** 10 | **Plans:** 40 | **Tasks:** 99

### What Was Built
- Mapping-table `company_id` tenancy (TENANT-01) and CPMO/PM/Viewer server authorization (USER/AUTH)
- Spec project master, assignment windows, stakeholders, RAID/milestone masters
- Weekly periods, versioned PM submit, CPMO tracking/export
- Parallel fiscal budget/ROI/dependencies; portfolio + PM dashboard APIs; Confluence document checklist
- Append-only `audit_logs` with company-scoped GET `/api/audit`

### What Worked
- Isolation none on the main tree after worktree races; sequential executors
- Locked D-23 leftover so ops/admin never became a moving target
- `ui_phase: false` kept the gate on Vitest instead of unbuilt screens
- TDD RED/GREEN commits plus review-fixer for WR findings (Phase 17 CR-01 tenant, Phase 18 audit-after-write)

### What Was Inefficient
- Nyquist VALIDATION.md stayed `draft` on all ten phases (never `$gsd-validate-phase`)
- Dashboard/weekly/checklist/audit APIs shipped without UI consumers (accepted, still a product gap)
- `listOpenProjectDependencies` exported for Phase 16 and never imported

### Patterns Established
- Parallel spec tables/APIs beside v1 (`project_fiscal_budgets`, `/api/dashboards/*`, document catalog vs JSON diary)
- `withCpmo` + `assertCompanyWrite` for company-write surfaces
- `auditLog` after successful repo write only; INSERT+SELECT repo contract with source-scan

### Key Lessons
1. Do not store spec fiscal data in v1 `budget_items`; keep a parallel ledger.
2. Stage-change checklist generate must use `project.company_id`, not `actor.company_id`.
3. Audit specialized actions (`code_change`) after the DB write, not before.

### Cost Observations
- Model mix: Grok 4.6 for plan/check; Composer 2.5 for research/execute/verify/review
- Isolation: sequential on main checkout (no worktrees)
- Notable: last phase (18) was three plans; lifecycle audit status `tech_debt` not `gaps_found`

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | What changed |
|-----------|----------------|
| v1.0 | First GSD-tracked reorg; autonomous close after Phase 8 filled the INTG-08 gap |
| v2.0 | Spec compliance on the layered stack; server tests as gate (`ui_phase` false); leftover ops/admin still carved out |

### Recurring Issues

- Operator-gated env/DB evidence (cutover script, TEST_DATABASE_URL) slips past the phase that introduced it
- Nyquist VALIDATION.md left `draft` unless `$gsd-validate-phase` is run explicitly
