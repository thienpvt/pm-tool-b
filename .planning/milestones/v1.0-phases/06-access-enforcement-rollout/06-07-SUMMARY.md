---
phase: 06-access-enforcement-rollout
plan: 07
subsystem: api
tags: [proxy, route-11, nextjs, empirical]

requires: []
provides:
  - "06-PROXY-FINDING.md — empirical ROUTE-11 answer: proxy.ts executes in standalone (307 to /login), route-level remains the session-validity layer"
affects: [06-VERIFICATION, REQUIREMENTS]

actuals:
  tokens: 4000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Next 16.2.4 standalone dispatch is recorded in functions-config-manifest.json, not middleware-manifest.json (the latter can be empty while proxy still runs)"

key-files:
  created:
    - .planning/phases/06-access-enforcement-rollout/06-PROXY-FINDING.md
  modified: []

key-decisions:
  - "Do not modify proxy.ts. Finding only. proxy.ts is live (cookie-presence 307); route wrappers still required for session validity and JSON 401/403."

requirements-completed: [ROUTE-11]

coverage:
  - id: D1
    description: "Static manifests + standalone curl: no-cookie /portfolio and /api/portfolio return 307 /login?from=..."
    requirement: ROUTE-11
    verification:
      - kind: empirical
        ref: ".planning/phases/06-access-enforcement-rollout/06-PROXY-FINDING.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "2026-08-25 reconfirm on next dev + Docker DATABASE_URL: same 307 Location headers"
    requirement: ROUTE-11
    verification:
      - kind: empirical
        ref: ".planning/phases/06-access-enforcement-rollout/06-UAT.md"
        status: pass
    human_judgment: false

key-commits:
  - "fe63bb2 (finding) — original 06-07 empirical write-up"
  - "aed4517 — REQUIREMENTS/ROADMAP ROUTE-11 checkbox catch-up"

self-check:
  - "proxy.ts was not modified"
  - "06-PROXY-FINDING.md exists with static + live curl evidence and an explicit conclusion"
---

# Phase 6 Plan 07 Summary — proxy.ts runtime finding (ROUTE-11)

**Outcome:** `06-PROXY-FINDING.md` records that `proxy.ts` **does execute** in the standalone runtime. Empty `sortedMiddleware` is a red herring; live curl is 307 to `/login?from=...`. Route-level wrappers remain the session-validity + JSON 401/403 layer.

This SUMMARY was written 2026-08-25 to close the phase-complete gate (`06-07-PLAN.md` had no `*-SUMMARY.md` even though the finding and ROADMAP checkbox were already done). UAT on 2026-08-25 reconfirmed the same 307s against `next dev`.
