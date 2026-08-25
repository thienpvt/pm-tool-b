---
phase: 7
slug: ui-decomposition
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-25
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (Wave 0 must add `{components,app}/**/*.component.test.tsx` to the jsdom project `include`) |
| **Quick run command** | `npx vitest run --project jsdom <page>.component.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds full suite (existing node + jsdom + new page tests) |

**Reporter caveat:** the default vitest reporter is mangled by an RTK shell hook in this environment and LOOKS like failure. Prefer `--reporter=json --outputFile=vt.json` (repo-relative), parse with node, and `rm vt.json` after. Exit codes are trustworthy.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project jsdom <new-or-touched>.component.test.tsx`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green + UI-09 grep clean + `npx tsc --noEmit` 0
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-00-01 | 00 | 0 | UI-10 | — | jsdom project includes `*.component.test.tsx` | config | `npx vitest list --project jsdom` finds `*.component.test.tsx` | ❌ W0 | ⬜ pending |
| 07-01-01 | 01 | 1 | UI-08 / UI-10 / UI-11 | T-07-01 | Home page load + one view-toggle interaction with mocked fetch | component | `npx vitest run --project jsdom app/page.component.test.tsx` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | UI-02 / UI-10 / UI-11 | T-07-01 | Portfolio report load + one filter interaction | component | `npx vitest run --project jsdom app/portfolio/report/page.component.test.tsx` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | UI-03 / UI-10 / UI-11 | T-07-01 | Timeline load + one phase-filter interaction | component | `npx vitest run --project jsdom "app/projects/[id]/timeline/page.component.test.tsx"` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | UI-04 / UI-10 / UI-11 | T-07-01 | Project report load + one generate/export interaction | component | `npx vitest run --project jsdom "app/projects/[id]/report/page.component.test.tsx"` | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 2 | UI-05 / UI-10 / UI-11 | T-07-01 | Milestones load + one milestone-select interaction | component | `npx vitest run --project jsdom "app/projects/[id]/milestones/page.component.test.tsx"` | ❌ W0 | ⬜ pending |
| 07-06-01 | 06 | 3 | UI-06 / UI-10 / UI-11 | T-07-01 | Roadmap load + one program-filter interaction | component | `npx vitest run --project jsdom app/portfolio/roadmap/page.component.test.tsx` | ❌ W0 | ⬜ pending |
| 07-07-01 | 07 | 3 | UI-07 / UI-10 / UI-11 | T-07-01 | Import dialog render + mapping-step interaction | component | `npx vitest run --project jsdom components/timeline/ImportMappingDialog.component.test.tsx` | ❌ W0 | ⬜ pending |
| 07-08-01 | all | gate | UI-09 | T-07-01 | No client import of `@/lib/db`, repos, services, integration clients, or `pg` | static grep | `rg "from '@/lib/(db|repositories|services|integrations)|from 'pg'" app components --glob "*.tsx"` | ✅ gate | ⬜ pending |
| 07-09-01 | all | gate | UI-01 | — | Named hooks exist per page; fetch not inline in render modules | source | grep `use[A-Z]` colocated with each page | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — add `{components,app}/**/*.component.test.tsx` to jsdom project `include` (keep existing `*.test.tsx`)
- [ ] `app/page.component.test.tsx` — covers UI-08/UI-10/UI-11
- [ ] `app/portfolio/report/page.component.test.tsx` — covers UI-02
- [ ] `app/projects/[id]/timeline/page.component.test.tsx` — covers UI-03
- [ ] `app/projects/[id]/report/page.component.test.tsx` — covers UI-04
- [ ] `app/projects/[id]/milestones/page.component.test.tsx` — covers UI-05
- [ ] `app/portfolio/roadmap/page.component.test.tsx` — covers UI-06
- [ ] `components/timeline/ImportMappingDialog.component.test.tsx` — covers UI-07

*No new packages. Mock `fetch` with JSON fixtures. Shared `test/mock-fetch.ts` is YAGNI until 3+ pages duplicate the same helper.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screens stay recognizable after split | UI-11 visual identity | Component tests cover load + one interaction, not pixel identity. PROJECT forbids redesign; UAT confirms screens still look like the pre-refactor pages. | Open each of the 7 surfaces, confirm layout/copy/export entry points match the pre-split page. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
