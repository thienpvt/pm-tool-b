# Phase 17 Discussion Log

**Date:** 2026-08-26
**Mode:** Smart discuss `--auto` (user accepted all recommended defaults; continue until milestone done)

## Grey areas resolved

| ID | Question | Locked answer |
|----|----------|---------------|
| D-01 | v1 documents table? | Parallel catalog/templates/checklist; leave v1 |
| D-02–D-04 | Catalog / generate | Company-scoped; apply-to-in-flight explicit; generate on create + stage change; no DELETE of prior-stage rows |
| D-05 | Templates | Versioned replace; effective version default; project checklist never takes binaries |
| D-06–D-10 | Checklist / compliance | HTTPS Confluence only; approved needs date+approver; N/A needs reason; stage change 409 unless ack |
| D-11–D-14 | Schema / UI | Settings-flag after dashboards migrate; ui_phase false; incremental auditLog |

## Notes

- Isolation remains `none`.
- Reject multipart on checklist routes.
