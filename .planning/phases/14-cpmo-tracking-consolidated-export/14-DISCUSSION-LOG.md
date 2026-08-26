# Phase 14 Discussion Log

**Date:** 2026-08-26
**Mode:** Smart discuss `--auto` (user accepted all recommended defaults)

## Grey areas resolved

| ID | Question | Locked answer |
|----|----------|---------------|
| D-01 | Export RAID source | Latest submitted snapshot only |
| D-02 | Tech-council filter vs export | Live issues for filter; snapshot subset for pack |
| D-03 | Tracking route | `GET /api/weekly-periods/[periodId]/tracking` + `withCpmo` |
| D-04 | Count semantics | Stored status + computed overdue + `first_lateness` late |
| D-05 | Filters | Query params; `status=overdue` is computed |
| D-06 | Preview / reorder | POST preview; order = `project_ids` array |
| D-07 | Export formats | New routes; xlsx + docx + pptx; not v1 weekly-report export |
| D-08 | Section fields | Snapshot only; blank if missing |
| D-09 | Export record | `weekly_export_logs` + auditLog |
| D-10 | Schema | Extend weekly-reports migration family after `migrateWeeklyReports` |
| D-11 | Authz | CPMO + company write only |
| D-12 | UI | `ui_phase=false`; server tests are the gate |
| D-13 | Shell query | Extend `listPeriodShells`; company-scope at service |
| D-14 | Errors | Existing Validation/NotFound/Conflict types |

## Notes

- Phase 13 shipped `listPeriodShells` and `SubmitValidationError` for this consumer.
- Isolation remains `none` (HEAD diverged from origin; no worktrees).
