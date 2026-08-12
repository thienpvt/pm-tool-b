---
phase: quick/260812-l1n
plan: 01
subsystem: branding
tags: [branding, logo, ui]
status: complete
dependency-graph:
  requires: []
  provides: [components/brand/Logo.tsx]
  affects: [components/layout/Sidebar.tsx, app/login/page.tsx, app/landing/page.tsx, components/onboarding/OnboardingModal.tsx, app/icon.svg]
tech-stack:
  added: []
  patterns: ["next/image with .svg src (auto-unoptimized)", "app/icon.svg metadata file convention"]
key-files:
  created:
    - components/brand/Logo.tsx
    - app/icon.svg
  modified:
    - components/layout/Sidebar.tsx
    - app/login/page.tsx
    - app/landing/page.tsx
    - components/onboarding/OnboardingModal.tsx
decisions:
  - "Two-state Logo component (className + onDark) — no size/variant system, since call sites only differ on dark-background contrast."
  - "White chip wrapper (not brightness-0/invert filter) preserves both SHB brand colors when onDark."
actuals:
  tokens: 42000
  tasks: 3
  commits: 3
metrics:
  duration: ~35min
  completed: 2026-08-12
---

# Phase quick/260812-l1n Plan 01: Change logo to SHB and rebrand Gambaru to SHB One Portfolio View Summary

Replaced 4 duplicated inline `KoinoboriIcon` SVG definitions with one shared `Logo` component rendering `public/shb-logo.svg` via `next/image`, wired into all 9 logo slots (sidebar x2, login, onboarding, landing x6 counted separately — see below), and rebranded every remaining "Gambaru" string to "SHB One Portfolio View". Replaced the stock Next.js favicon with the orange SHB S glyph.

## What Was Built

**`components/brand/Logo.tsx`** — new shared component. `Logo({ className, onDark })` renders `next/image` at `/shb-logo.svg` (1350x540 intrinsic, `w-auto` on the wrapper class to preserve 2.5:1 aspect). When `onDark` is true, wraps the image in a white rounded chip (`bg-white`) to keep the navy `#2f2e79` wordmark legible against `#0f172a`/dark backgrounds — deliberately not a `brightness-0 invert` filter, which would have destroyed the orange S glyph.

**Call sites updated** (removed local `KoinoboriIcon`, deleted its wrapping square/tinted `div`, replaced with `<Logo />`):
- `components/layout/Sidebar.tsx` — desktop nav header + mobile top bar (both `onDark`, on `#0f172a`)
- `app/login/page.tsx` — dark login screen (`onDark`), plus rebranded `h1` and footer text
- `components/onboarding/OnboardingModal.tsx` — gradient header slot (no `onDark` needed)
- `app/landing/page.tsx` — 6 slots: navbar (white bg), browser-mockup sidebar (`onDark`), Step-01 illustration chip (`onDark`, was on blue-600), final CTA (`onDark`), footer (`onDark`)

**Rebrand** — every "Gambaru" occurrence in `app/landing/page.tsx` and `app/login/page.tsx` changed to "SHB One Portfolio View" (hero paragraph, mockup address bar → `portfolio.shb.com.vn`, mockup sidebar badge with `leading-tight` for wrap, problem-statement paragraph, export feature desc, features paragraph, onboarding-preview heading, "Why Gambaru" eyebrow/comment, CTA paragraph, footer wordmark).

**`app/icon.svg`** — new favicon containing only the 3 orange `cls-1` paths from `public/shb-logo.svg` (the S glyph), cropped to `viewBox="97 100 340 340"`. `app/favicon.ico` deleted; Next resolves the new icon via the file-convention automatically (no `<link>`, no `metadata.icons` added).

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint` on task-touched files — 0 errors (2 pre-existing unrelated warnings in `app/landing/page.tsx`: unused `ChevronRight` import, unused `Icon` destructure — both predate this task, confirmed via `git show HEAD~3:app/landing/page.tsx`)
- `grep -ric 'gambaru\|koinobori' app components` — zero matches in every file
- `grep -rn 'viewBox="0 0 28 28"' app components` — zero matches (no duplicate inline icon defs remain)
- `npm run build` — succeeds

Full-repo `npm run lint` shows 168 pre-existing errors/warnings in files this plan never touched (`app/resources/page.tsx`, `components/bugs/BugImportDialog.tsx`, `components/jira/JiraSyncDialog.tsx`, `components/timeline/ImportMappingDialog.tsx`, `lib/export/excel.ts`, `lib/export/word.ts` — mostly `react-hooks/set-state-in-effect` and unused-var warnings). Out of scope per plan scope boundary; not fixed.

## Deviations from Plan

None — plan executed exactly as written. Three judgement calls the plan explicitly delegated were resolved as specified: fake address bar → `portfolio.shb.com.vn`, mockup sidebar badge got `leading-tight` and wraps to two lines, `'PM Tool'` tenant-fallback strings on `Sidebar.tsx:98/337` and `OnboardingModal.tsx` eyebrow left untouched (not the product name).

## Known Stubs

None.

## Commits

- `e0665fe` — feat(quick-260812-l1n): shared Logo component wired into sidebar
- `0f176ec` — feat(quick-260812-l1n): swap remaining logo slots and rebrand product name
- `124194e` — feat(quick-260812-l1n): replace default favicon with SHB S mark

## Self-Check: PASSED

- FOUND: components/brand/Logo.tsx
- FOUND: app/icon.svg
- FOUND: e0665fe
- FOUND: 0f176ec
- FOUND: 124194e
