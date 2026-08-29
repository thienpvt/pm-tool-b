# Phase 27: Nits, Validation & Operator Gate - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Leftover nits resolved, every v2.1 phase has a reconciled VALIDATION.md, operator confirms Anthropic 502.

**Requirements:** NIT-01, NIT-02, NIT-03, NYQ-01, HYG-02

**In:**
- Prove or finish NIT-01 consumption of `listPeriodShells` / `listOpenProjectDependencies`
- No-op milestone PATCH must not append audit
- Document v1 `budget_items` vs fiscal ledger (recommended over UI rewrite)
- Reconcile draft/false VALIDATION.md for phases 19+ (especially 19, 26)
- Record HYG-02 operator accept of 502 (no code rewrite)

**Out:**
- Rewriting report routes to 500
- Rewriting archived v1.0/v2.0 VALIDATION.md
- New product screens
- New npm

</domain>

<decisions>
## Implementation Decisions

- **D-01 (NIT-01):** Keep the functions. They are already consumed (`listPeriodShells` via weekly-reports.service + dashboards spec; `listOpenProjectDependencies` via repo + tests). Add a small contract test that those consumers still import them. Do not delete.
- **D-02 (NIT-02):** Skip `audit_logs` insert when a milestone PATCH payload is a no-op (before equals after). Keep audits for real field changes.
- **D-03 (NIT-03):** Document coexistence: v1 `budget_items` remains for project budget screens; fiscal ledger is `/portfolio/budget` + fiscal APIs. Do not rewrite budget UI this phase. Write `.planning/BUDGET-COEXISTENCE.md` (or equivalent in phase dir).
- **D-04 (HYG-02):** Operator **accepts** Anthropic malformed-output **502** (vs old 500) for the three report routes. No code change. Record acceptance in CONTEXT + a short `27-HYG-02.md` artifact.
- **D-05 (NYQ-01):** Reconcile remaining draft/`nyquist_compliant: false` VALIDATION.md files for phases 19–26, and write a non-draft `27-VALIDATION.md` for this closeout phase. Do not rewrite archived v1.0/v2.0 VALIDATION.md.
- **D-06:** No new npm. Isolation none. TDD. No visual redesign. Skip UI-SPEC (docs + audit skip, not new chrome). Preserve D-23.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 27
- `.planning/REQUIREMENTS.md` NIT-01..03, NYQ-01, HYG-02
- `modules/weekly/backend/services/weekly-reports.service.ts` `listPeriodShells`
- `modules/projects/backend/repositories/project-dependencies.repo.ts` `listOpenProjectDependencies`
- Milestone PATCH + audit path
</canonical_refs>

<code_context>
## Existing Code Insights

NIT-01 consumers already exist. HYG-02 is a checkpoint, not a rewrite.

</code_context>

<specifics>
## Specific Ideas

Grey areas auto-accepted: keep NIT-01 wiring, skip no-op milestone audit, document budget coexistence, accept 502, reconcile VALIDATION files.
</specifics>

<deferred>
## Deferred Ideas

None — last phase of v2.1.
</deferred>
