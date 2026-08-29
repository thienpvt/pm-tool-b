# Roadmap: PM Tool B

## Overview

v1.0 shipped the layer reorg (route → service → repository), tenant wrappers, integration clients, and god-page splits. v2.0 brought that stack into compliance with the GuiIT Portfolio One View spec: CPMO / PM / Viewer authorization, L0–L5 project master, RAID and milestones as masters with immutable weekly snapshots, CPMO period cadence, portfolio/PM dashboard APIs, Confluence document checklists, and a company-scoped append-only audit log — without replacing Jira import, AI reports, or Excel/PPT/Word export.

v2.1 closes leftover debt on that stack: one external migration cutover, leftover route/API hygiene, React consumers for the v2 APIs (landed in per-module `ui/`), a repo-wide backend/UI split, Kysely on the existing pool, performance budgets, and a nits/Nyquist/operator closeout. Phase numbering continues from v2.0 (Phases 9–18). v2.1 is Phases 19–27. Granularity is `standard`; nine phases (not twelve) because DATA-01..03 stay one migration task, leftover route debt clusters, and nits/Nyquist/HYG-02 close out together.

## Milestones

- ✅ **v1.0 Layer Reorg & Hardening** — Phases 1–8 (shipped 2026-08-25)
- ✅ **v2.0 Portfolio One View** — Phases 9–18 (shipped 2026-08-26)
- ✅ **v2.1 Hardening & Deferred Debt** — Phases 19–27 (shipped 2026-08-29)

## Phases

<details>
<summary>✅ v1.0 Layer Reorg & Hardening (Phases 1–8) — SHIPPED 2026-08-25</summary>

- [x] Phase 1: Test Harness (1/1 plans) — completed 2026-08-07
- [x] Phase 2: Repository Layer (3/3 plans) — completed 2026-08-10
- [x] Phase 3: Integration Clients (4/4 plans) — completed 2026-08-10
- [x] Phase 4: Service Layer (7/7 plans) — completed 2026-08-11
- [x] Phase 5: Route Thinning & Validation (3/3 plans) — completed 2026-08-11
- [x] Phase 6: Access Enforcement Rollout (7/7 plans) — completed 2026-08-25
- [x] Phase 7: UI Decomposition (9/9 plans) — completed 2026-08-25
- [x] Phase 8: INTG-08 Credential Cutover (1/1 plans) — completed 2026-08-25

Full phase detail: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Requirements archive: [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
Audit: [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v2.0 Portfolio One View (Phases 9–18) — SHIPPED 2026-08-26</summary>

- [x] Phase 9: Mapping Table Tenant Isolation (3/3 plans) — completed 2026-08-26
- [x] Phase 10: Users, Roles & Server Authorization (11/11 plans) — completed 2026-08-26
- [x] Phase 11: Project Master, PM Assignment & Stakeholders (5/5 plans) — completed 2026-08-26
- [x] Phase 12: Milestone & RAID Master Registers (3/3 plans) — completed 2026-08-26
- [x] Phase 13: Weekly Periods & PM Submit (3/3 plans) — completed 2026-08-26
- [x] Phase 14: CPMO Tracking & Consolidated Export (3/3 plans) — completed 2026-08-26
- [x] Phase 15: Budget, Value, ROI & Dependencies (3/3 plans) — completed 2026-08-26
- [x] Phase 16: Portfolio & PM Dashboards (3/3 plans) — completed 2026-08-26
- [x] Phase 17: Document Templates & Confluence Checklist (3/3 plans) — completed 2026-08-26
- [x] Phase 18: Append-Only Audit Log (3/3 plans) — completed 2026-08-26

Full phase detail: [.planning/milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
Requirements archive: [.planning/milestones/v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md)
Audit: [.planning/milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) (`tech_debt`, 79/79 requirements)
Phase artifacts: [.planning/milestones/v2.0-phases/](milestones/v2.0-phases/)

</details>

<details>
<summary>✅ v2.1 Hardening & Deferred Debt (Phases 19–27) — SHIPPED 2026-08-29</summary>

- [x] Phase 19: Data Layer Cutover (4/4 plans) — completed 2026-08-28
- [x] Phase 20: API Contract & Leftover Routes (7/7 plans) — completed 2026-08-28
- [x] Phase 21: Portfolio & PM Dashboard Pages (4/4 plans) — completed 2026-08-28
- [x] Phase 22: Weekly Workflow Surfaces (5/5 plans) — completed 2026-08-28
- [x] Phase 23: Document Checklist & Audit Viewer (5/5 plans) — completed 2026-08-28
- [x] Phase 24: Repo-wide Module Split (10/10 plans) — completed 2026-08-28
- [x] Phase 25: Kysely Repositories (15/15 plans) — completed 2026-08-29
- [x] Phase 26: RSC Chrome & Cold Start (3/3 plans) — completed 2026-08-29
- [x] Phase 27: Nits, Validation & Operator Gate (3/3 plans) — completed 2026-08-29

Full phase detail: [.planning/milestones/v2.1-ROADMAP.md](milestones/v2.1-ROADMAP.md)
Requirements archive: [.planning/milestones/v2.1-REQUIREMENTS.md](milestones/v2.1-REQUIREMENTS.md)
Audit: [.planning/milestones/v2.1-MILESTONE-AUDIT.md](milestones/v2.1-MILESTONE-AUDIT.md) (`passed`, 28/28 requirements)
Phase artifacts: [.planning/milestones/v2.1-phases/](milestones/v2.1-phases/)

</details>

## Phase Details

No active milestone. Start the next cycle with `/gsd-new-milestone`.

## Progress

v1.0 Phases 1–8, v2.0 Phases 9–18, and v2.1 Phases 19–27 are complete (see milestone archives above).
