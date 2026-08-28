# Feature Research

**Domain:** Bank PPM / Portfolio One View (CPMO, PM, Viewer) — v2.0 spec compliance on brownfield app
**Researched:** 2026-08-25
**Confidence:** HIGH (GuiIT spec Draft 1.0 read directly; enterprise PPM patterns cross-checked against Planview/Clarity/PMI status-report conventions)

## Feature Landscape

Enterprise PMO/PPM tools (Planview, Broadcom Clarity, Microsoft Project Online, Smartsheet PMO templates) converge on: **one master register** for projects/RAID/milestones, **role-scoped access**, **periodic status capture with immutable snapshots**, and **portfolio dashboards that drill down to the same numbers**. The GuiIT spec is tighter and more prescriptive than generic PPM — bank governance (L0–L5, RAG rules, Confluence-only documents, CPMO-owned identity fields) is the product shape, not optional configuration.

**Already shipped (v1.0 — do not re-scope as v2.0 table stakes unless the spec requires a different shape):** multi-tenant login (`company_id`, `is_admin`), project CRUD + nested resources (activities, risks, issues, meetings, team, documents, bugs, holidays, milestones, budget), portfolio views (home, roadmap, report, budget, members), activity-weighted weekly *computed* reports, Jira import, AI report generation, Excel/PPT/Word/PDF export, layer hardening (`withAuth` / `withProjectAccess`, repositories, Vitest).

---

### Admin — PR-01, PR-02

| ID | Feature | Category | Why Expected (Enterprise) | Spec vs Typical PPM | Complexity | Existing Dependency / Gap |
|----|---------|----------|---------------------------|---------------------|------------|---------------------------|
| PR-01 | User & role master (unique username/email, multi-role union, Active/Inactive/Locked, soft-delete) | **Table stakes** | Every enterprise PPM has user provisioning, role assignment, and account lifecycle; banks require audit trail and no physical delete of actors tied to history | **Stricter than typical:** username/email uniqueness even when locked; multi-role union (CPMO+PM); explicit Locked state; audit on every change. Typical tools use group-based RBAC with simpler deactivate | **Medium** — schema + admin UI + uniqueness constraints + audit | **Partial:** `users` table + admin page exist (`is_admin`, `company_id`). **Gap:** no CPMO/PM/Viewer roles, no Locked/Inactive lifecycle, no multi-role union, no email uniqueness enforcement |
| PR-02 | Login, session, server-side authz (CPMO / PM / Viewer) | **Table stakes** | Instance/global + object-level rights (Clarity access-rights model); PMO tools fail audits when UI hiding substitutes for API enforcement | **Matches bank norm:** CPMO=all portfolio; PM=assigned projects only; Viewer=read-only; server enforcement mandatory; session extension without losing draft | **High** — replaces `is_admin` boolean with role matrix + project-scoped checks across all routes | **Partial:** scrypt auth, DB sessions, `withProjectAccess` tenant guard. **Gap:** no CPMO/PM/Viewer; PM scope not tied to assignment; dashboards/routes still largely company-wide for non-admins |

**Admin opinion:** PR-01 and PR-02 are the **foundation phase** — every other PR-ID depends on correct role + project scope. Do not bolt L0–L5 or weekly snapshots onto the current `is_admin` model; it will leak data.

---

### Portfolio Master — PR-03..PR-09

| ID | Feature | Category | Why Expected (Enterprise) | Spec vs Typical PPM | Complexity | Existing Dependency / Gap |
|----|---------|----------|---------------------------|---------------------|------------|---------------------------|
| PR-03 | Project master (identity, L0–L5, status, RAG rules, progress %, timeline, weekly-report flag) | **Table stakes** | Portfolio tools always have project registry with health (RAG) and lifecycle stage; executives expect one canonical project record | **Bank-specific:** L0–L5 (not generic phases); CPMO-only identity fields; coupled Stage/Status/RAG defaults + override warnings; weekly-report obligation flag with start period; progress must not overwrite historical report snapshots | **High** — field model rewrite, validation engine, migration from free-text phases | **Partial:** project CRUD, RAG field, phases as strings, portfolio list. **Gap:** no L0–L5, no status/RAG coupling rules, no weekly-report flag/period, PM-editable identity fields today |
| PR-04 | PM assignment (one primary, collaborating PMs, history) | **Table stakes** | PM scope in Clarity/Planview comes from named PM on project; collaboration is common but secondary | **Clearer than many tools:** exactly one active primary; optional collaborators; explicit history periods; project may have no PM; cannot have collaborators without primary | **Medium** — assignment table + history + authz integration | **Partial:** `pm_name` on project, team members. **Gap:** no formal assignment entity, no history, no collaborator role, authz not driven by assignment |
| PR-05 | Stakeholders (sponsor, PSC, director, external parties, effective dates) | **Table stakes** | Governance registers (sponsor, steering committee) appear in every PMO charter template | **Richer than typical:** effective-date ranges per role; external parties without accounts; unified feed for dashboards/reports | **Medium** — stakeholder entity overlaps PR-03 governance fields; needs single source of truth decision | **Partial:** governance names on project record. **Gap:** no effective dating, no external-party records, duplication risk with PR-03 fields |
| PR-06 | Cross-project dependencies | **Differentiator (within bank spec)** | Clarity/Planview support inter-project dependencies; many mid-market tools omit or weakly support | **Focused:** source/target projects, direction, need-by date, validity window, bidirectional display, PM visibility on both sides | **Medium** — new entity + validation (no self-link, no duplicate active) + portfolio surfacing | **None** — greenfield within app |
| PR-07 | Milestones (due/overdue, weekly snapshot, no physical delete after report) | **Table stakes** | Milestone tracking + overdue lists are standard portfolio dashboard widgets (Smartsheet/ProjectManager templates) | **Stricter:** 7-day upcoming warning; overdue rules tied to plan/adjusted dates; **immutable snapshot in weekly report**; soft-delete only if never reported | **Medium–High** — extends existing milestones + snapshot linkage on submit | **Partial:** milestones CRUD exists. **Gap:** no upcoming/overdue engine per spec, no report snapshot coupling, physical delete likely still allowed |
| PR-08 | Budget & value (approved vs actual, financial/non-financial benefits, ROI) | **Table stakes** | PPM without approved/actual/spend variance is incomplete for IT PMO; ROI/benefits tracking is common in Clarity/Planview | **Detailed:** fiscal-year rows, cost-type catalog, adjustment history (never overwrite approvals), ROI formulas with "insufficient data" (not fake 0%), non-financial benefit KPIs | **High** — new budget/value sub-model beyond simple budget lines | **Partial:** budget resource exists. **Gap:** no fiscal-year dimension, no adjustment audit trail, no ROI/benefits split, likely not aligned to spec formulas |
| PR-09 | RAID master + weekly sync (register is master; draft changes sync on submit) | **Table stakes** | RAID in status reports is universal; best practice is **one register**, not duplicate RAID in reports | **Critical spec pattern:** weekly report holds draft RAID deltas; **on submit** merges to master + locks snapshot; overdue/high flags on dashboards. Typical tools either live-edit register OR copy-on-submit — spec requires both with sync rules | **High** — transactional submit flow touching risks, issues, report snapshot | **Partial:** risks/issues CRUD per project. **Gap:** no master/register discipline, no weekly draft buffer, no submit-sync, no tech-council issue flag from PR-13 |

**Portfolio master opinion:** PR-03 is the **data model anchor** — stage/status/RAG/weekly flag drive PR-10 obligation, PR-13 KPI definitions, and PR-15 document checklists. PR-09 + PR-11 submit is the **highest-risk integration** (master vs snapshot divergence is the #1 PMO tool failure mode).

---

### Weekly Report — PR-10, PR-11, PR-12

| ID | Feature | Category | Why Expected (Enterprise) | Spec vs Typical PPM | Complexity | Existing Dependency / Gap |
|----|---------|----------|---------------------------|---------------------|------------|---------------------------|
| PR-10 | CPMO weekly period config (period bounds, due datetime, auto-create reports, overdue rules) | **Table stakes** | PMO calendars define reporting period, cut-off, and late flags; auto-generation reduces PM friction | **Prescriptive:** period label `YYYY-Wnn \| dd/mm – dd/mm`; due time (e.g. Thu 16:00); config snapshotted per period; retroactive periods not backfilled when flag turned on | **Medium** — scheduler/cron + period entity + snapshot of config | **None** — current reports use ad-hoc week bounds in `getWeeklyProjectReport`, no persisted periods |
| PR-11 | PM draft/submit weekly report with versioned snapshots | **Table stakes** | Weekly status report = highlights, completed, next week, RAID, decisions needed (PMI/Atlassian/ProjectManager canon) | **Major shape change vs app today:** not activity-weighted % computation — **structured PMO form** with immutable submitted versions, post-submit corrections as new versions, RAG/previous-RAG, milestone/RAID/dependency sections, sync to master on submit | **Very High** — new report entity, state machine (Chưa nộp/Nháp/Đã nộp), version table, submit transaction | **Partial:** `getWeeklyProjectReport` aggregates live data; AI/template portfolio reports. **Gap:** no persisted submissions, no versioning, no draft RAID buffer, no obligation tracking |
| PR-12 | CPMO submission tracking, consolidate, export | **Table stakes** | CPMO office lives in "who submitted, who is late" grids; consolidation into leadership pack is standard | **Explicit:** filter by period/status/on-time/PM/stage/RAG/tech issues; tick-select projects for consolidated export; on-time vs late locked to **first submit**; editable export template | **Medium–High** — CPMO ops UI + export pipeline (can extend existing Excel/PPT/Word) | **Partial:** portfolio report generation/export. **Gap:** no submission registry, no late/on-time semantics, no selective consolidation |

**Weekly report opinion:** This cluster is **not an enhancement** to existing report pages — it is a **parallel product surface**. Reusing export/AI clients (differentiators) is correct; reusing activity-weighted completion as "progress" in submitted reports is **wrong** per spec (PR-03 progress is explicit PM-entered %).

---

### Dashboards — PR-13, PR-14

| ID | Feature | Category | Why Expected (Enterprise) | Spec vs Typical PPM | Complexity | Existing Dependency / Gap |
|----|---------|----------|---------------------------|---------------------|------------|---------------------------|
| PR-13 | Portfolio dashboard (active count, RAG, L0–L5, high RAID, overdue milestones, drill-down) | **Table stakes** | Portfolio dashboard = KPI tiles + distribution charts + filtered project list with consistent counts (Planview portfolio dashboard pattern) | **Rule-heavy:** "active" = Status Active AND stage L0–L4; RAG chart must sum to active count; high RAID counts **records** not projects; tech-council issues as separate tile; global AND filters with drill-down inheritance | **High** — KPI engine must match list queries exactly; export Excel/PDF | **Partial:** portfolio home/report pages with KPI-ish views. **Gap:** definitions don't match spec; no drill-down contract; no tech-issue tile |
| PR-14 | PM personal dashboard (assigned projects + weekly/milestone/RAID actions) | **Table stakes** | PM landing = "my work queue" (submit report, fix overdue milestone, escalate high RAID) — standard in Clarity/Planview role landing | **Action-oriented:** explicit action cards with deep links; refreshes after action; scoped to PM assignment (PR-04) | **Medium** — query layer over PR-04/07/09/11 | **Partial:** project dashboard exists but project-scoped, not PM queue. **Gap:** no action queue, no assignment-scoped portfolio slice |

**Dashboards opinion:** Build **after** master data + weekly obligation exist; otherwise KPIs and action cards lie. PR-13 and PR-14 should share query functions to prevent portfolio vs PM count drift.

---

### Documents — PR-15

| ID | Feature | Category | Why Expected (Enterprise) | Spec vs Typical PPM | Complexity | Existing Dependency / Gap |
|----|---------|----------|---------------------------|---------------------|------------|---------------------------|
| PR-15 | CPMO templates + Confluence checklist (no project file upload) | **Differentiator (within bank spec)** | Most PPM tools either host documents (SharePoint/Confluence integration with upload) or skip compliance tracking | **Bank anti-DMS:** templates stored in-app; project artifacts live on Confluence (link + metadata only); stage-based mandatory checklist; compliance rollup for CPMO; stage-change warning if mandatory docs incomplete | **High** — template versioning + checklist generation on stage change + compliance analytics | **Partial:** project documents module exists (likely upload-oriented). **Gap:** must **remove/replace** upload path; add catalog, template lifecycle, Confluence link validation, compliance dashboard |

**Documents opinion:** Deliberately **not** table stakes for generic PPM, but **table stakes for this bank spec**. The anti-feature is in-app binary storage (see Anti-Features).

---

### Tenant Follow-up — TENANT-01

| ID | Feature | Category | Why Expected (Enterprise) | Spec vs Typical PPM | Complexity | Existing Dependency / Gap |
|----|---------|----------|---------------------------|---------------------|------------|---------------------------|
| TENANT-01 | `company_id` on four mapping tables | **Table stakes (tenant isolation)** | Multi-tenant SaaS must scope integration mappings per company — v1.0 left holes | **Technical debt closure:** `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings` | **Low–Medium** — migration + repo WHERE clauses + tests | **Gap:** tables lack `company_id`; cross-tenant IDOR risk for Jira/timeline import config |

---

### Shipped Differentiators (retain, not v2.0 scope)

| Feature | Value Proposition | Notes |
|---------|-------------------|-------|
| Jira Cloud import + sync mappings | Execution data freshness without double entry | Keep; extend with TENANT-01 scoping |
| AI report generation (Anthropic) | Faster leadership narrative from structured data | Keep for portfolio/project reports **alongside** spec weekly submit — do not substitute for PR-11 |
| Excel / PPT / Word / PDF export | Bank deliverable formats | Reuse for PR-12 consolidated export and PR-13 dashboard export |
| Activity-weighted progress analytics | Engineering truth for delivery teams | **Not** the spec's weekly-report progress field — keep as supplementary analytics only |

---

### Anti-Features (Commonly Requested, Problematic for This Spec)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| In-app upload of project document binaries (PR-15) | "One place for everything" | Spec explicitly forbids; duplicates Confluence; increases ATTT scope | Confluence link + metadata checklist only |
| Second RAID copy editable independently of register | Faster PM data entry | Creates two sources of truth; breaks PR-09 submit-sync | Draft in weekly report → sync to master on submit |
| Real-time editable submitted weekly reports | Fix typos without friction | Destroys audit trail; violates bank snapshot principle | PR-11 post-submit correction = **new version**, first-submit time preserved |
| Replacing spec weekly report with AI-generated narrative | Less PM workload | Non-deterministic; not comparable week-to-week; fails CPMO tracking | AI assists **optional** export (already shipped), structured form remains source of truth |
| Generic custom fields / user-defined lifecycle | Flexibility | Breaks L0–L5, RAG, dashboard KPI, and document checklist rules | Fixed enumerations per spec; defer generic metadata platform |
| Backfilling weekly reports when obligation flag turned on | Catch up history | Spec forbids retroactive obligation; distorts compliance metrics | Start obligation from configured period forward only |
| UI-only authorization (hide buttons) | Faster UI delivery | Explicitly rejected in PR-02; bank ATTT failure | Server-side checks on every API + route |
| Activity-weighted % as official project progress in PMO reports | Already implemented | Conflicts with PR-03 explicit progress % and historical report integrity | Separate "engineering progress" view if needed; PM-entered % for PMO |
| Full PPM replacement (resources, financials ERP, agile boards) | Enterprise suite ambition | Out of scope; spec is portfolio one-view + weekly PMO cadence | Jira for execution; this app for portfolio master + reporting |

---

## Feature Dependencies

```
PR-01 Users/Roles
    └──requires──> PR-02 Authz (roles must exist to enforce)
                       └──requires──> PR-04 PM assignment (PM scope)
                                              └──requires──> PR-14 PM dashboard

PR-03 Project master (L0-L5, RAG, weekly flag)
    ├──requires──> PR-01/02 (CPMO-only fields)
    ├──requires──> PR-05 Stakeholders (governance fields — resolve duplication)
    ├──feeds──> PR-10 (weekly obligation from flag + start period)
    ├──feeds──> PR-13 (active/RAG/stage KPI definitions)
    └──feeds──> PR-15 (stage-based document checklist)

PR-07 Milestones ──snapshot on submit──> PR-11 Weekly report
PR-09 RAID master ──draft/sync on submit──> PR-11 Weekly report

PR-10 Period config ──creates obligation──> PR-11 PM submit
PR-11 Submitted reports ──feeds──> PR-12 CPMO tracking/export
PR-11/12 ──feeds──> PR-13/14 dashboards (actions & compliance)

PR-08 Budget/value ──optional in weekly──> PR-11 (dashboard rollup in PR-13)

TENANT-01 ──parallel──> any phase touching Jira/timeline import (no product dependency on PR-01..15 order)

Shipped: Jira/AI/Export ──enhances──> PR-12, PR-13 export surfaces (must not block spec compliance)
```

### Dependency Notes

- **PR-01 → PR-02:** Role union and account states are meaningless without enforcement on every route.
- **PR-03 → PR-10/11:** Weekly-report flag and start period gate automatic report creation — without PR-03 rules, obligation engine misfires.
- **PR-09 ↔ PR-11:** Submit transaction is the costliest integration; draft RAID must not touch master until submit succeeds atomically.
- **PR-04 → PR-14:** PM dashboard actions must filter by assignment, not merely `company_id`.
- **PR-07/09 → PR-11:** Snapshot tables link report version to source milestone/RAID rows; implement before allowing milestone hard-delete.
- **PR-15 vs existing documents:** Likely **conflicts** with upload-based documents module — pick spec shape, don't combine.

---

## MVP Definition (v2.0 — spec compliance, not greenfield MVP)

### Launch With (v2.0 must ship)

- [ ] **PR-01 + PR-02** — Roles and server authz (blocks everything)
- [ ] **PR-03 + PR-04** — Project master + PM assignment (defines who sees what)
- [ ] **PR-07 + PR-09** — Milestones and RAID master (report inputs)
- [ ] **PR-10 + PR-11 + PR-12** — Period config, PM submit/versioning, CPMO tracking (core PMO cadence)
- [ ] **PR-13 + PR-14** — Portfolio and PM dashboards (executive + PM value)
- [ ] **PR-05, PR-06, PR-08, PR-15** — Stakeholders, dependencies, budget/value, documents (spec completeness)
- [ ] **TENANT-01** — Mapping table tenant columns (isolation hardening)

### Already Validated (do not regress)

- [x] Multi-tenant login and company scoping
- [x] Project CRUD + nested RAID/milestones/budget/activities
- [x] Jira import, AI reports, Excel/PPT/Word export
- [x] Layer architecture and authorization wrappers

### Defer (explicitly out of v2.0)

- [ ] DATA-01..03 migrations out of `getDb()` — deferred per PROJECT.md
- [ ] ENF/PERF packs — deferred
- [ ] Replacing Jira/AI/export — never; they stay as differentiators

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PR-01/02 Admin & authz | HIGH | HIGH | P1 |
| PR-03 Project master | HIGH | HIGH | P1 |
| PR-04 PM assignment | HIGH | MEDIUM | P1 |
| PR-10 Period config | HIGH | MEDIUM | P1 |
| PR-11 Weekly submit/version | HIGH | VERY HIGH | P1 |
| PR-09 RAID sync | HIGH | HIGH | P1 |
| PR-07 Milestones + snapshot | HIGH | MEDIUM | P1 |
| PR-12 CPMO tracking/export | HIGH | MEDIUM | P1 |
| PR-13 Portfolio dashboard | HIGH | HIGH | P1 |
| PR-14 PM dashboard | HIGH | MEDIUM | P1 |
| PR-05 Stakeholders | MEDIUM | MEDIUM | P1 |
| PR-08 Budget/value/ROI | MEDIUM | HIGH | P1 |
| PR-15 Documents/Confluence | MEDIUM | HIGH | P1 |
| PR-06 Dependencies | MEDIUM | MEDIUM | P2 (spec included — ship in v2.0 but after core auth/master/report path) |
| TENANT-01 Mapping tables | HIGH (security) | LOW | P1 (can parallel early) |

**Priority key:** P1 = spec requirement for v2.0; P2 = same milestone, sequenced after foundation.

---

## Competitor Feature Analysis

| Capability | Planview / Clarity (typical) | This spec (GuiIT) | Our approach |
|------------|------------------------------|-------------------|--------------|
| Roles | Instance + global access rights, groups | Three fixed roles + project assignment | PR-01/02/04; replace `is_admin` |
| Weekly status | Status reports + dashboards; some AI assist | Mandatory periodic submit, versioned snapshot, RAID sync | PR-10–12 new module; keep AI as optional overlay |
| Progress | Schedule % complete, earned value | PM-entered % with L5=100% rules | PR-03 field; keep activity-weighted as secondary analytics |
| Documents | DMS integration or attachments | Templates in-app; Confluence links only | PR-15; **anti** upload |
| Portfolio KPIs | Configurable portlets | Fixed KPI definitions with drill-down | PR-13 exact rules |
| Integrations | Many ERP/ALM connectors | Jira + export + AI (already shipped) | Differentiators retained |

---

## Table Stakes Summary (v2.0 — missing or wrong shape today)

1. **PR-01/02** — CPMO/PM/Viewer with server enforcement (not `is_admin` only)
2. **PR-03** — L0–L5 project master with RAG/status coupling and weekly-report flag
3. **PR-04** — Formal PM primary/collaborator assignment driving access
4. **PR-07** — Milestone overdue/upcoming + report snapshot immutability
5. **PR-09** — RAID register as master with weekly draft/sync on submit
6. **PR-10/11/12** — Configured periods, PM submit/versioning, CPMO late tracking & consolidation
7. **PR-13/14** — Spec-defined portfolio and PM action dashboards
8. **PR-08** — Fiscal-year budget, adjustments history, ROI/benefits
9. **PR-05/15** — Stakeholders with effective dates; Confluence checklist compliance
10. **TENANT-01** — Company scoping on import mapping tables

---

## Sources

- GuiIT Portfolio One View business spec Draft 1.0 (20/08/2026) — local `docs/GuiIT_2008_Portfolio One View_Yeu cau nghiep vu (1).docx` (HIGH)
- `.planning/PROJECT.md` v2.0 requirements (HIGH)
- Existing codebase: `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, `lib/services/project-report.service.ts` (HIGH)
- Broadcom Clarity PPM Access Rights Reference (MEDIUM)
- Planview PPM / portfolio dashboard patterns (MEDIUM)
- PMI/Atlassian/ProjectManager weekly status report structure conventions (MEDIUM)

---
*Feature research for: Portfolio One View v2.0 (PR-01..PR-15, TENANT-01)*
*Researched: 2026-08-25*
