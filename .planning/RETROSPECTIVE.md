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

## Cross-Milestone Trends

### Process Evolution

| Milestone | What changed |
|-----------|----------------|
| v1.0 | First GSD-tracked reorg; autonomous close after Phase 8 filled the INTG-08 gap |

### Recurring Issues

- Operator-gated env/DB evidence (cutover script, TEST_DATABASE_URL) slips past the phase that introduced it
