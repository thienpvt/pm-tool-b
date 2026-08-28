# Roadmap: PM Tool B

## Overview

v1.0 shipped the layer reorg (route → service → repository), tenant wrappers, integration clients, and god-page splits. v2.0 brought that stack into compliance with the GuiIT Portfolio One View spec: CPMO / PM / Viewer authorization, L0–L5 project master, RAID and milestones as masters with immutable weekly snapshots, CPMO period cadence, portfolio/PM dashboard APIs, Confluence document checklists, and a company-scoped append-only audit log — without replacing Jira import, AI reports, or Excel/PPT/Word export.

No next milestone is planned yet. Leftover v1.0 debt (ops/admin thinning, proxy JSON 401, HYG-02) and optional UI for v2 APIs sit in PROJECT.md Active.

## Milestones

- ✅ **v1.0 Layer Reorg & Hardening** — Phases 1–8 (shipped 2026-08-25)
- ✅ **v2.0 Portfolio One View** — Phases 9–18 (shipped 2026-08-26)

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
