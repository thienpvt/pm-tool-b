# Phase 15 Discussion Log

**Date:** 2026-08-26
**Mode:** Smart discuss `--auto` (user accepted all recommended defaults; continue until milestone done)

## Grey areas resolved

| ID | Question | Locked answer |
|----|----------|---------------|
| D-01 | v1 budget_items? | Parallel fiscal tables; leave v1 line items |
| D-02 | Amounts | Integer VND; unique (project, fiscal_year, cost_type) |
| D-03 | Remaining / utilization | Computed; over_budget / fully_used flags not stored |
| D-04 | Approval changes | Append-only `budget_adjustments`; never UPDATE approved |
| D-05 | Authz | Write `assertProjectWriteAccess`; read `assertProjectAccess` |
| D-06–D-08 | Benefits / ROI | NULL actual ≠ 0; ROI insufficient not fake 0% |
| D-09–D-11 | Dependencies | Soft-end; both-end list; reject self/dup/invalid window |
| D-12–D-16 | Schema / UI | Settings-flag DDL after weekly migrate; ui_phase false |

## Notes

- Isolation remains `none`.
- Incremental `auditLog` on fiscal create, adjustment, benefit write, dependency create/end.
