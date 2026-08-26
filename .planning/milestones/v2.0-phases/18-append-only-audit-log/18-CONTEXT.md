# Phase 18: Append-Only Audit Log - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Complete AUDIT-01: governed mutations append an actor/time/entity/before-after record that cannot be edited in place, and another company cannot read those records. Incremental `auditLog` already exists (`lib/services/audit.service.ts` → `insertAuditLog` only). This phase **closes coverage gaps**, **proves immutability**, and **adds company-scoped read**.

**Requirements:** AUDIT-01

**In:** Inventory callers vs required entities (users, assignments, project master, RAID, milestones, budget adjustments, weekly submissions, document checklist status); add missing `auditLog` calls with before/after payloads; refuse UPDATE/DELETE of audit rows (no repo helpers, route tests 405 if any write route appears); GET `/api/audit` company-scoped (`withCpmo` + `assertCompanyWrite`); cross-company GET empty/403 not leak; after a later business edit, the original audit row is still readable unchanged.

**Out:** Rewriting every v1 ops/admin leftover to audit (D-23 leftover stays); UI-SPEC; dashboards; document binaries; new npm packages.

</domain>

<decisions>
## Implementation Decisions

- **D-01:** Keep the existing `audit_logs` (or current table name) + `auditLog()` INSERT path. Do not invent a second audit table. — **Reversibility:** costly.
- **D-02:** Required entity_type coverage (must fire on mutators): `user`, `pm_assignment`, `project`, `raid` (risks+issues), `milestone`, `budget_adjustment` (already Phase 15), `weekly_report` (submit/correct), `document_checklist`. Planner inventories existing calls and fills gaps only.
- **D-03:** Payload must include actor id, timestamp, entity_type, entity_id, action, `before` and/or `after` JSON. Missing before on create is OK; missing after on soft-end is OK.
- **D-04:** Immutability: `audit.repo.ts` exports INSERT (and SELECT) only — no UPDATE/DELETE functions. Add a unit test that the module source does not contain `UPDATE audit` / `DELETE FROM audit`. Do not add PATCH/DELETE HTTP on `/api/audit`.
- **D-05:** `company_id` on each row (stamp from actor.company_id at insert; if column missing, add via settings-flag migrate). GET lists `WHERE company_id = actor.company_id`. Foreign-company actor never sees rows. Null-company CPMO/admin 403 via `assertCompanyWrite`.
- **D-06:** GET `/api/audit` withCpmo + optional filters entity_type, entity_id, from/to dates. Viewer/PM 403. Pagination: limit default 50 max 200.
- **D-07:** After a second mutation on the same entity, both audit rows remain; first row's actor/time/payload unchanged (repo+service test).
- **D-08:** `workflow.ui_phase` false. Server tests are the gate.
- **D-09:** No CASL. Do not re-gate D-23 leftover. Do not require audit on leftover ops/admin/config.
- **D-10:** Settings-flag only if a new column (`company_id`) or index is needed; wire after `migrateDocuments`.

### the agent's Discretion

- Exact table name (use existing). Whether to backfill `company_id` on old rows from actor snapshot JSON or leave NULL (NULLs hidden from company GET — OK).
- Whether RAID is one entity_type `raid` with subtype in payload vs `risk`/`issue`.

</decisions>

<canonical_refs>
- `.planning/ROADMAP.md` Phase 18
- `.planning/REQUIREMENTS.md` AUDIT-01
- `.planning/PROJECT.md`
- `lib/services/audit.service.ts`
- `lib/repositories/audit.repo.ts`
- Phase 10–17 CONTEXT incremental auditLog notes
</canonical_refs>

<code_context>
## Existing Code Insights

- `auditLog` is INSERT-only today (comment D-08 in audit.service.ts)
- 48 callers already — inventory gaps vs D-02 rather than wrapping everything
- Seed admin null company_id → 403 on GET (correct)

</code_context>

<deferred>
None in-milestone after this phase. Lifecycle: audit-milestone → complete-milestone → cleanup.
</deferred>

---

*Phase: 18-append-only-audit-log*
*Context gathered: 2026-08-26*
