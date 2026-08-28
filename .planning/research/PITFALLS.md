# Pitfalls Research

**Domain:** Adding bank-style Portfolio One View (PR-01..PR-15, TENANT-01) onto the existing post-reorg Next.js 16 multi-tenant PPM app
**Researched:** 2026-08-25
**Confidence:** HIGH for codebase-specific integration pitfalls (verified against live `lib/services/access.ts`, `import-mapping.repo.ts`, `documents.service.ts`, `admin.repo.ts`, `milestones.repo.ts`, weekly-report flows); MEDIUM for spec nuance (Word spec is local reference only, not independently re-read this run)

## Critical Pitfalls

### Pitfall 1: Replacing `is_admin` with CPMO/PM/Viewer breaks existing admin and ops paths

**What goes wrong:**
The app today has a single privilege bit: `user.is_admin` bypasses company scoping in `assertProjectAccess`, `listProjects`, portfolio aggregates, and gates `/api/admin/*` via `requireAdmin`. v2.0 introduces CPMO / PM / Viewer with project-scoped PM access. A naive swap — e.g. `if (role === 'CPMO')` everywhere `is_admin` was — breaks: (a) legacy admin screens (user CRUD, RAG config, Jira credential config) that still exist; (b) ops/admin routes that never got the v1.0 service layer (`operations/*`, `config`, import-mapping) and still check `is_admin` directly; (c) cross-company portfolio views where CPMO is company-scoped but today's admin sees all tenants. Worse: mapping CPMO → `is_admin = 1` as a shortcut preserves old behavior but gives CPMO global cross-tenant access the spec forbids.

**Why it happens:**
Brownfield role migration is usually done as a boolean rename. The codebase has **two** authorization shapes — `AccessActor { company_id, is_admin }` on the hardened project path and ad-hoc `user.is_admin` on admin/ops routes — so a single replacement point does not exist.

**How to avoid:**
- Introduce an explicit role model (`user_roles` or role enum + assignment table) and a **single** `authorize(action, resource, actor)` helper; do not scatter role checks in UI.
- Keep a transitional compatibility layer: `isPlatformAdmin` (ops only, rare) vs `isCPMO(companyId)` vs `isPM(projectId)` vs `isViewer(projectId)`. Document which legacy routes map to which.
- Migrate route-by-route: project-scoped routes first (already on `withAuth`/`withProjectAccess`), then admin routes, then ops debt routes. Grep `is_admin` and `requireAdmin` before declaring PR-02 done.
- Tests: CPMO cannot read company B; PM cannot mutate company B project; Viewer read-only on assigned projects; legacy admin config routes still reachable by designated ops account.

**Warning signs:**
- Grep shows mixed `is_admin` and `role === 'CPMO'` checks.
- CPMO user sees projects outside their company in portfolio list.
- PM can hit `/api/admin/users` because CPMO was mapped to admin flag.
- 403 storm on routes that previously worked for "admin" users.

**Phase to address:** Auth & roles foundation (PR-01, PR-02) — must land before dashboards, weekly-report submit, or CPMO export phases.

---

### Pitfall 2: Weekly report becomes a second RAID source of truth instead of master + snapshot

**What goes wrong:**
Today `getWeeklyProjectReport` reads **live** open risks/issues from `risks`/`issues` tables and stores narrative output in `documents` (`type: status_report`) as overwriteable JSON. The spec requires a **RAID register master** (PR-09) with **immutable snapshots** copied into the weekly report at PM submit (PR-11). If the weekly-report UI keeps editing risks inline, or the report generator keeps querying live RAID at export time, submitted reports drift from what CPMO saw. Portfolio dashboards then disagree with archived weekly reports — a bank audit failure.

**Why it happens:**
The existing weekly-report flow (`app/projects/[id]/reports/page.tsx`, `documents.service.ts` upsert) was built as "generate narrative + save document." RAID is already editable on the risks/issues pages. The path of least resistance is to embed RAID in the report JSON rather than snapshot from master at submit.

**How to avoid:**
- Enforce data flow: **master RAID** → on submit, **copy** to `weekly_report_raid_snapshot` (or embedded snapshot rows keyed by report version) → report PDF/Excel/export reads snapshot only.
- Draft reports may pull live master for preview; **submitted** status locks snapshot. Re-open for edit creates a new draft version, not an in-place mutation of submitted snapshot.
- Single write path: PM edits RAID on register pages (master), not inside weekly-report wizard (except draft-only staging that copies on submit).
- Tests: submit report → change master risk priority → submitted report and CPMO export unchanged.

**Warning signs:**
- Weekly report API joins `risks`/`issues` without `report_version_id` filter.
- No `submitted_at` / `version` column on weekly reports.
- Export route uses live RAID query (same as `project-report.service.ts` today).

**Phase to address:** RAID master (PR-09) before PM submit/versioning (PR-11); snapshot contract tested before CPMO export (PR-12).

---

### Pitfall 3: Editing a submitted weekly report overwrites historical record

**What goes wrong:**
Current save flow uses PUT to `/api/projects/[id]/documents` and `updateDocumentContent` — same row, new JSON. PM "fixes a typo" in last week's submitted report and silently rewrites history. CPMO consolidated export and leadership packs then disagree with what was originally submitted. Spec requires versioned submit, not diary overwrite.

**Why it happens:**
`documents.service.ts` treats `status_report` as append-only on POST but the reports page selects an existing doc and PUTs updates (`selectedDocId` branch in `reports/page.tsx`). No submitted/immutable flag exists.

**How to avoid:**
- Submitted reports are **immutable**; corrections require a new version or an explicit "amendment" record with audit trail (user, timestamp, reason).
- Separate tables: `weekly_report_periods`, `weekly_report_versions` with status enum (`draft`, `submitted`, `locked`).
- UI: disable edit on submitted rows; offer "Create amendment" or "New draft for period" instead.
- DB constraint: trigger or check preventing UPDATE on rows where `status = 'submitted'`.

**Warning signs:**
- PUT handler accepts updates to submitted reports without version bump.
- Only one row per project per period with no version history.
- Export uses latest document content regardless of submit timestamp.

**Phase to address:** PM draft/submit with versioning (PR-11); CPMO tracking (PR-12) must read versioned store.

---

### Pitfall 4: ROI displays 0% instead of "insufficient data" when inputs are missing

**What goes wrong:**
Budget today exposes `approved_amount` / `actual_amount` per line item (`budget.service.ts`) but has no spec-compliant ROI/benefits model. Implementers compute `ROI = (benefit - cost) / cost * 100` and return `0` when `cost` is null, zero, or benefits are unset — indistinguishable from a real 0% ROI. CPMO portfolio views show a wall of "0%" that reads as healthy/neutral instead of "unknown," violating PR-08 and misleading leadership.

**Why it happens:**
Numeric formatters default null → 0 for charts. Excel/export templates expect numbers. "Insufficient data" is a string/UI concern developers defer.

**How to avoid:**
- Model ROI as `{ value: number | null, status: 'ok' | 'insufficient_data' }` in service layer; never coerce null to 0 for display.
- Validate at input: financial benefits require approved budget; non-financial benefits optional but typed.
- UI, export, and dashboard all branch on `status`, not `value === 0`.
- Tests: missing approved budget → `insufficient_data`; zero cost → `insufficient_data`, not 0%.

**Warning signs:**
- `?? 0` or `|| 0` in ROI calculation.
- Portfolio budget widget shows 0% for projects without benefits entered.
- Excel export prints `0%` in ROI column for empty projects.

**Phase to address:** Budget and value (PR-08); dashboard phases (PR-13) consume the typed ROI result.

---

### Pitfall 5: Physical delete of users or milestones that appear in submitted reports

**What goes wrong:**
`deleteAdminUser` runs `DELETE FROM users`; `milestones.repo.ts` runs `DELETE FROM milestones`. If a PM, milestone, or owner referenced in a submitted weekly snapshot is deleted, historical reports show broken references, orphan IDs, or blank names — unacceptable for bank audit. Spec (PR-01, PR-07) requires no physical delete after report involvement.

**Why it happens:**
Existing CRUD patterns expose trash buttons (`MilestoneList.tsx`, admin users DELETE). FK constraints may CASCADE or SET NULL unpredictably. Soft-delete is not modeled.

**How to avoid:**
- Replace DELETE with `status = 'inactive'` / `deleted_at` for users; `is_active = false` for milestones with referential integrity preserved.
- Guard delete API: reject if entity ID appears in any `submitted` weekly report snapshot or RAID snapshot (service-level check, not UI-only).
- Reports store **display names** in snapshot at submit time (denormalized copy) so later deactivation does not blank history.
- Admin UI: "Deactivate" not "Delete"; milestone list hides inactive from planning views but keeps for history.

**Warning signs:**
- SQL still contains `DELETE FROM users` / `DELETE FROM milestones` without guard.
- Foreign keys ON DELETE CASCADE from milestones to report tables.
- Weekly export shows `null` for PM name after user removed.

**Phase to address:** Users and roles (PR-01) and milestones (PR-07) early; deletion guards before weekly submit (PR-11).

---

### Pitfall 6: PM uploads files instead of Confluence links for project documents

**What goes wrong:**
Spec PR-15: CPMO publishes templates; PM completes a **Confluence checklist** (link + metadata only, no binary upload). Current `documents` page stores full text/JSON content in DB (`documents.service.ts`, large inline forms in `documents/page.tsx`) and weekly reports are saved as generated HTML/text blobs. Adding `<input type="file">` or reusing timeline CSV upload patterns would violate spec and bank ATTT (files outside controlled Confluence).

**Why it happens:**
Existing UX is "fill form in app" for charter/SOW/PMP. Confluence integration is harder than a file picker. PMs expect upload because other modules (timeline import, bug import) accept files.

**How to avoid:**
- PR-15 document checklist: fields are `confluence_url`, `page_title`, `last_verified_at`, `template_version` — no `content_blob` for spec types.
- Server rejects multipart uploads on project document routes; Zod schema allows URL only.
- CPMO template admin defines required checklist items; PM marks complete with link.
- Keep generated weekly report artifacts separate from PR-15 document checklist (different table/feature).

**Warning signs:**
- `rawBody: true` or multipart handler on documents route.
- `documents.content_json` stores base64 or file paths.
- UI shows "Upload" for charter/SOW/PMP types.

**Phase to address:** Project documents / Confluence checklist (PR-15); do not extend legacy `documents` upsert without schema split.

---

### Pitfall 7: Adding `company_id` to mapping tables without backfill and unique-key migration

**What goes wrong:**
Four tables are **global** today: `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings` (`import-mapping.repo.ts` comment: "global, not company-scoped"). Adding `company_id NOT NULL` without backfill fails migration; leaving NULL allows cross-tenant reads. Adding `company_id` filter but keeping global `UNIQUE(name)` blocks two tenants from using the same template name. Worst case: backfill all rows to `company_id = 1`, exposing Company A's Jira JQL presets to Company B.

**Why it happens:**
TENANT-01 is scoped as a small schema add. Repos and routes (`/api/import-mapping`, `/api/bug-import-mapping`, Jira preset routes) list all rows with no tenant predicate. v1.0 intentionally deferred this.

**How to avoid:**
- Migration steps: add nullable `company_id` → backfill from creating user's company or safe default per row → enforce NOT NULL → drop old global unique constraints → add `UNIQUE(company_id, name)`.
- Update every repo method to require `companyId` parameter; route layer passes session company.
- Cross-company test: Company A preset not visible to Company B (403 or empty list).
- For rows with unknown provenance, assign to platform ops company or quarantine in admin review — never default all to one production tenant silently.

**Warning signs:**
- `SELECT * FROM timeline_import_mappings` without `WHERE company_id = ?`.
- Migration adds column but no unique index change.
- Integration tests still use single global fixture.

**Phase to address:** TENANT-01 — schedule after auth/session company context is stable (PR-02), before any new import UX.

---

### Pitfall 8: UI hides action buttons but API still allows the mutation

**What goes wrong:**
Spec and PROJECT.md constraint: "hiding UI is not access control." v1.0 closed many IDOR holes with `withProjectAccess`, but authorization is **tenant**-based, not **role**-based. A Viewer PM who cannot see "Edit" in React can still POST to `/api/projects/[id]/risks` if they know the URL. After roles land, teams often hide buttons first and defer server checks — especially on routes still calling repos directly (config, import-mapping, admin).

**Why it happens:**
Frontend role gating is faster and visible in UAT. Server-side matrix (CPMO vs PM vs Viewer × resource × action) is tedious to enumerate. Existing tests cover cross-company 403, not Viewer write denial.

**How to avoid:**
- Define authorization matrix in one module (`lib/services/authorize.ts`); services call it at top of every mutating method.
- Route tests per role: Viewer POST → 403; PM on unassigned project → 403; CPMO company-scoped approve → 200.
- Do not merge UI role gating PR without matching API tests in same plan.
- Audit ops/admin routes still on `requireAdmin` — map to CPMO or separate ops role explicitly.

**Warning signs:**
- Role checks only in `components/**` or `Sidebar.tsx`.
- Test suite has cross-company cases but no Viewer-write cases.
- curl/Postman can mutate data the UI hides.

**Phase to address:** PR-02 (server-side authorization) in same phase as role model; every subsequent feature phase adds role tests for its routes.

---

### Pitfall 9: L0–L5 stage rules and RAG overrides applied silently without audit trail

**What goes wrong:**
Projects use free-text `current_phase` (e.g. `'Initiation'`) and computed RAG via `calculateRAG` (`lib/rag.ts`) with per-company thresholds (`company_rag_config`). Spec PR-03 requires L0–L5 lifecycle stages with default RAG rules and explicit user override with **warning** when override diverges from computed status. Implementers either: (a) rename phases cosmetically without validation rules; (b) store manual RAG in `projects.rag` without override flag — portfolio report then mixes computed and manual inconsistently (`portfolio-report.service.ts` vs `portfolio.service.ts` already diverge on RAG); (c) auto-sync override silently, losing audit trail for leadership reviews.

**Why it happens:**
Existing RAG engine is SPI/deadline/risk/issue based, not L0–L5 stage based. Spec adds stage-default RAG matrix plus override UX. Easy path is to keep old calculation and add a color picker.

**How to avoid:**
- Model: `rag_computed`, `rag_display`, `rag_override_reason`, `rag_override_by`, `rag_override_at`.
- On save: if `rag_display !== rag_computed`, require reason (min length) and show spec-mandated warning in UI.
- Stage transitions (L0→L1…) validate allowed transitions and dates; default RAG derived from stage table unless overridden.
- Portfolio/dashboard APIs document which RAG field they expose (display vs computed).
- Tests: override without reason → 400; Closing phase → green default per existing `lib/rag.ts` behavior preserved.

**Warning signs:**
- Single `rag` column written from UI with no computed sibling.
- No audit columns on project update.
- Dashboard counts red/amber/green differently than project detail page.

**Phase to address:** Project master data (PR-03); RAG override rules before portfolio dashboard (PR-13).

---

### Pitfall 10: Tenant isolation regresses when role scoping replaces company-only checks

**What goes wrong:**
v1.0 enforcement is `company_id` match (or admin bypass). v2.0 adds **project assignment**: PM sees only assigned projects, CPMO sees company portfolio. Bug pattern: replace `assertProjectAccess` with `assertPMAssignment` but drop company check → PM moved to new company still accesses old project IDs; or CPMO query forgets company filter when joining assignments. Aggregate routes (portfolio report, export, AI prompt building) are highest risk — same class as v1.0 Pitfall 4 but now with role dimension.

**Why it happens:**
New join tables (`project_pm_assignments`) add query complexity. Services reuse `listProjects(isAdmin)` patterns without filtering by assignment. Tests only cover company A vs B, not PM1 vs PM2 within company A.

**How to avoid:**
- Every query takes `(companyId, userId, roles)` and applies **both** company and assignment filters unless CPMO portfolio view explicitly widens.
- PM list: `assigned_projects`; CPMO list: `company_projects`; Viewer: read-only assigned.
- Extend test matrix: same company, different PMs, different project sets; CPMO sees all company projects; Viewer cannot POST.
- Reuse v1.0 shadow-mode logging (`ACCESS_ENFORCEMENT=shadow`) when rolling out assignment checks.

**Warning signs:**
- Repository method accepts `userId` but WHERE clause only has `company_id`.
- Portfolio aggregate returns projects PM is not assigned to.
- No test file named `role-assignment` or `pm-scoping`.

**Phase to address:** PR-02 + PR-04 (PM assignment) together; regression tests on portfolio/report/export (PR-12, PR-13).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Map CPMO → `is_admin = 1` | Unblocks admin routes quickly | Cross-tenant data exposure; fails bank audit | **Never** |
| Store weekly RAID only in report JSON | Avoids snapshot tables | Two sources of truth; CPMO export drift | **Never** for submitted reports |
| ROI `null → 0` for charts | Simpler chart components | False portfolio health signal | **Never** |
| Global mapping tables + app filter only | Smaller migration | IDOR via guessed mapping id | **Never** after TENANT-01 |
| Hide buttons, defer API authz | Faster UI demo | Viewer/PM curl mutations | **Never** |
| Extend legacy `documents` table for Confluence | Reuse CRUD | Binary upload creep; wrong schema | **Never** for PR-15 checklist |
| Manual RAG color on project row | Matches today's field | No override audit; dashboard inconsistency | **Never** without override metadata |
| Physical delete for "cleanup" | Simple SQL | Broken historical reports | **Never** after PR-07/PR-11 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira import mappings (TENANT-01) | Scope presets by company in UI only | `company_id` on `jira_jql_presets` + repo filter; resolver uses tenant creds |
| AI weekly report (Anthropic) | Prompt pulls live RAID after submit | Prompt builder reads snapshot for submitted period; live only for draft |
| Excel/PPT/Word export | Export recomputes ROI/RAG from master | Export reads snapshot + typed ROI status for locked reports |
| Confluence (PR-15) | Store page HTML in DB | Store URL + metadata; optional future API verify link alive |
| Portfolio email (Resend) | Embeds current project RAG | Embed `rag_display` at send time from report snapshot |
| Admin user API | Keep `requireAdmin` forever | Split platform ops vs CPMO company admin; document migration |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Snapshot explosion (RAID × milestones × versions) | Slow submit, large DB | Normalize snapshot rows; index `(project_id, period_id, version)` | ~50 projects × weekly × 2 years |
| Portfolio dashboard N+1 assignment joins | p95 latency spike on home | Single query with assignment join; materialized counts for CPMO | CPMO opens dashboard with 100+ projects |
| Recompute RAG on every dashboard paint | CPU hot on `calculateRAG` | Persist computed RAG; recompute on master change events | Every portfolio page load |
| Weekly report export joins live timeline | Timeout on Excel export | Export reads snapshot tables only | Large projects with 10k activities |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Viewer write via unguarded API | Data tampering on read-only role | Service-level `authorize()` on every mutator (Pitfall 8) |
| Cross-tenant mapping preset by ID | Company B uses Company A's Jira JQL | TENANT-01 repo scoping + 403 on wrong `company_id` |
| CPMO mapped to global admin | All-tenant portfolio leak | Company-bound CPMO role; separate break-glass ops |
| Confluence URL → SSRF if server fetches URL | Internal network probe | Store link only; do not server-side fetch arbitrary URLs |
| Weekly report snapshot contains PII without role gate | Viewer sees escalation details | Field-level redaction or role filter on snapshot read |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Edit submitted report in place | PM thinks minor edit is safe; history lost | Immutable submitted + explicit new version/amendment |
| 0% ROI on empty budget | CPMO thinks project has zero return | "Insufficient data" label + grey state |
| Override RAG without warning | Leadership sees red without knowing manual | Warning modal + reason required + badge "Manual override" |
| Hide unavailable actions | User thinks app is broken | Disable with tooltip "Viewer role" OR hide only after server confirms |
| Confluence checklist vs in-app forms | PM confused where to put charter | Separate nav: "Document checklist (Confluence)" vs "Weekly report" |

---

## "Looks Done But Isn't" Checklist

- [ ] **Roles:** UI shows CPMO/PM/Viewer but API accepts old session without role claims — verify Viewer POST → 403
- [ ] **Weekly submit:** Button says "Submit" but PUT still overwrites same document row — verify version increment + immutability
- [ ] **RAID snapshot:** Report "looks correct" in preview — verify after submit, master change does not alter export
- [ ] **ROI:** Dashboard shows 0% — verify null benefits return `insufficient_data`, not numeric zero
- [ ] **Milestones:** Delete button removed — verify API DELETE returns 409 if milestone in submitted report
- [ ] **Documents:** No file input — verify API rejects multipart and stores only Confluence URL fields
- [ ] **TENANT-01:** Column exists — verify cross-company integration test on all four mapping tables
- [ ] **RAG override:** Color shows on project — verify audit columns populated when override ≠ computed
- [ ] **PM assignment:** PM sees project list — verify only assigned projects, not all company projects
- [ ] **CPMO export:** Excel generates — verify uses submitted snapshot not live RAID/budget

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Second RAID truth (Pitfall 2) | HIGH | Freeze submits; backfill snapshots from last export; redirect reads to snapshot |
| Overwritten report history (Pitfall 3) | HIGH | Restore from DB backups/binlogs if available; else mark period "data incomplete" |
| ROI 0% display (Pitfall 4) | LOW | Fix formatter; redeploy; no data migration |
| Physical delete (Pitfall 5) | MEDIUM | Restore soft-delete columns from backup; re-link FKs; denormalize names into snapshots going forward |
| Mapping table wrong tenant (Pitfall 7) | MEDIUM | Re-backfill `company_id` from audit logs; re-test Jira imports per company |
| Role/authz holes (Pitfall 8) | MEDIUM | Hotfix authorize checks; disable mutating routes until patched |
| is_admin migration break (Pitfall 1) | MEDIUM | Rollback role mapping; re-enable compatibility shim |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| is_admin → roles break (1) | PR-01 / PR-02 Auth & roles | Grep zero ad-hoc `is_admin` on product routes; role matrix tests pass |
| RAID second source (2) | PR-09 RAID master, then PR-11 submit | Post-submit master mutation does not change export |
| Report history overwrite (3) | PR-11 versioning | PUT on submitted → 409; version history API |
| ROI 0% vs insufficient (4) | PR-08 budget/value | Unit tests for null inputs; UI shows label |
| Physical delete (5) | PR-01 users, PR-07 milestones | DELETE → deactivate; guard when referenced |
| File upload vs Confluence (6) | PR-15 documents | API rejects upload; checklist URL-only schema |
| Mapping `company_id` (7) | TENANT-01 | Cross-company 403 on preset/mapping IDs |
| UI-only authz (8) | PR-02 (every later phase) | Viewer curl tests per route |
| L0–L5 / RAG override (9) | PR-03 project master | Override requires reason; audit columns set |
| Tenant + role regression (10) | PR-02 + PR-04 + PR-12/13 | PM scoping tests; shadow log review |

### Suggested phase ordering (pitfall-driven)

1. **Auth & roles (PR-01, PR-02)** — Pitfalls 1, 8, 10 foundation  
2. **Project master + L0–L5/RAG (PR-03)** — Pitfall 9  
3. **PM assignment (PR-04)** — Pitfall 10 completion  
4. **RAID master (PR-09)** — Pitfall 2 before any submit work  
5. **Milestones + soft delete (PR-07)** — Pitfall 5  
6. **Budget/value + ROI (PR-08)** — Pitfall 4  
7. **Weekly period + submit/version (PR-10, PR-11)** — Pitfalls 2, 3  
8. **CPMO tracking/export (PR-12)** — snapshot-only reads  
9. **Dashboards (PR-13, PR-14)** — typed ROI + assignment filters  
10. **Confluence documents (PR-15)** — Pitfall 6  
11. **TENANT-01 mapping tables** — Pitfall 7 (after PR-02 company context stable)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| PR-01 Users | Physical delete users | Deactivate + reference guard |
| PR-02 Auth | UI-only role gating | Service `authorize()` + role tests |
| PR-03 Master data | Manual RAG without audit | Computed vs display + reason |
| PR-04 PM assign | Drop company check | Both company and assignment in assert |
| PR-07 Milestones | DELETE milestone in report | Soft delete + submit reference check |
| PR-08 Budget | ROI null → 0 | Typed insufficient state |
| PR-09 RAID | Inline edit in weekly UI | Master register only; snapshot on submit |
| PR-11 Submit | PUT overwrites document | Version table + immutability |
| PR-12 Export | Live RAID in export | Snapshot reader only |
| PR-13 Dashboard | Wrong RAG field | Standardize on `rag_display` |
| PR-15 Documents | File upload | URL-only schema |
| TENANT-01 | Global rows after migration | Backfill + unique(company_id, name) |

---

## Sources

- `.planning/PROJECT.md` — v2.0 requirements PR-01..PR-15, TENANT-01, constraints (server-side authz, Confluence-only docs)
- `lib/services/access.ts` — `is_admin` bypass in `assertProjectAccess`
- `lib/repositories/import-mapping.repo.ts` — global mapping tables (no `company_id`)
- `lib/services/documents.service.ts` — status_report upsert/overwrite behavior
- `lib/services/project-report.service.ts` — live RAID read for weekly report
- `app/projects/[id]/reports/page.tsx` — PUT saved report overwrite flow
- `lib/repositories/admin.repo.ts`, `app/api/admin/users/route.ts` — physical user delete
- `lib/repositories/milestones.repo.ts` — physical milestone delete
- `lib/rag.ts`, `lib/services/portfolio-report.service.ts` — RAG computation patterns
- `lib/services/budget.service.ts` — approved/actual without ROI insufficient handling
- v1.0 `.planning/research/PITFALLS.md` — aggregate tenant leak pattern (superseded for product work; tenant isolation retained as Pitfall 10)

---
*Pitfalls research for: v2.0 Portfolio One View on post-reorg PM Tool B*
*Researched: 2026-08-25*
