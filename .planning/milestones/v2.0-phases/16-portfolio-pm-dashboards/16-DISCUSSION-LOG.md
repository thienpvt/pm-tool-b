# Phase 16 Discussion Log

**Date:** 2026-08-26
**Mode:** Smart discuss `--auto` (user accepted all recommended defaults; continue until milestone done)

## Grey areas resolved

| ID | Question | Locked answer |
|----|----------|---------------|
| D-01 | v1 GET /api/portfolio? | Parallel `/api/dashboards/*`; leave v1 summary/RAG |
| D-02–D-05 | KPI math | Active = status Active + stage L0–L4; on-track Green; watch Amber/Red; missing rag → Amber; consume Phase 12 list helpers |
| D-06–D-08 | Filters / export | AND filters; `dashboard_filter_state` per user+surface; xlsx+pdf; no new packages |
| D-09–D-11 | PM surface | Assignment-window list; weekly shells without `getPeriodTracking`; live GET after mutators |
| D-12–D-16 | Auth / UI / source | withCpmo+assertCompanyWrite on portfolio; ui_phase false; live project rag not snapshot |

## Notes

- Isolation remains `none`.
- Do not call `getPeriodTracking` from the PM dashboard.
- Incremental `auditLog` on dashboard export only.
