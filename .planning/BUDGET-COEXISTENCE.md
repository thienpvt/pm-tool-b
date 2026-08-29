# Budget Coexistence Map (NIT-03, D-03)

**Phase 27 — v2.1 closeout.** Both budget data stores remain in production use. This phase documents coexistence only — **no budget UI rewrite, no redirects, no schema merge** (D-03, D-06).

---

## Two Stores

| Model | Table | Purpose |
|-------|-------|---------|
| **v1 project budget** | `budget_items` | Per-project line items (planned/approved/actual amounts, expenses) on project budget screens |
| **Fiscal ledger (spec)** | `project_fiscal_budgets` | Portfolio-level fiscal periods, categories, and project allocations |

Kysely registers both in `lib/db/database.ts` (`budget_items`, `project_fiscal_budgets`).

---

## v1 Project Budget (`budget_items`)

| Layer | Path |
|-------|------|
| Repository | `modules/projects/backend/repositories/budget.repo.ts` |
| Service | `modules/projects/backend/services/budget-items.service.ts` |
| HTTP | `app/api/projects/[id]/budget/**` (items, expenses) |
| UI | Project-scoped budget screens (consumes project budget APIs) |

**Behavior:** CRUD on `budget_items` and related expense rows; `actual_amount` kept in sync with expense sums inside the repository.

---

## Fiscal Ledger (`project_fiscal_budgets`)

| Layer | Path |
|-------|------|
| Repository | `modules/portfolio/backend/repositories/fiscal-budget.repo.ts` |
| HTTP | `/api/portfolio/budgets` (periods, categories, allocations) |
| UI | `modules/portfolio/ui/budget/PortfolioBudgetPage.tsx` at `/portfolio/budget` |

**Behavior:** Portfolio PM manages fiscal periods, category ceilings, and project allocations. Some project pages may read fiscal allocations via `/api/portfolio/budgets` for cross-reference — that is intentional, not a migration target.

---

## Operator Guidance

1. **Do not assume one store replaces the other.** Project budget screens use `budget_items`; portfolio fiscal planning uses `project_fiscal_budgets`.
2. **No unification in Phase 27.** Merging UI or data models is deferred beyond v2.1.
3. **Both APIs stay supported.** Clients must call the API appropriate to their screen (project vs portfolio).

---

## Out of Scope (Phase 27)

- Rewriting `PortfolioBudgetPage` or project budget UI
- Redirecting project budget routes to fiscal ledger
- Dropping `budget_items` or migrating rows into `project_fiscal_budgets`
- New npm packages or UI-SPEC (D-06)

**Requirement:** NIT-03 — documented coexistence satisfies the v2.1 nit without product changes.
