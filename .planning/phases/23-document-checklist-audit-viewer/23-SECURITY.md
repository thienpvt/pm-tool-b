---
phase: 23
slug: document-checklist-audit-viewer
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-08-28
---

# Phase 23 — Security

> Document catalog/templates, PM Confluence checklist, CPMO compliance, and company audit viewer — UI-only modules consuming Phase 17/18 APIs. No new API surface; authz remains `withCpmo` / `withProjectAccess` / `assertProjectWriteAccess`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → `/api/document-catalog`, `/api/document-templates` | Session cookie; CPMO writes | Catalog + URL templates |
| Browser → `/api/projects/{id}/document-checklist` | Session cookie; project access; write assert on PATCH | Checklist metadata + HTTPS URL |
| Browser → `/api/dashboards/document-compliance` | Session cookie; CPMO | Compliance grid |
| Browser → `GET /api/audit` | Session cookie; CPMO | Audit rows + before/after JSON |
| Sidebar NAV | Role-gated links are UX only | Nav visibility |
| Client UI → v1 `/api/projects/{id}/documents` | **Must not mix into spec checklist** | N/A |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-23-01 | Elevation of Privilege | Catalog page / Sidebar | high | mitigate | NAV hide is not policy; 401/403 in-page; `withCpmo` on writes | closed |
| T-23-02 | Information Disclosure | Catalog/templates fetch | medium | mitigate | Existing catalog/template URLs only | closed |
| T-23-03 | Tampering | Catalog mutations | high | mitigate | Zod `.strict()` + `withCpmo`; JSON POST/PATCH only | closed |
| T-23-04 | Tampering | Template URL | medium | mitigate | HTTPS client check + server `parseHttpsUrl`; no file input | closed |
| T-23-05 | Elevation of Privilege | Checklist editor | high | mitigate | `assertProjectWriteAccess`; 403 in-page | closed |
| T-23-06 | Tampering | Checklist binaries | medium | mitigate | No file input; server `rejectBinaryFields` + HTTPS | closed |
| T-23-07 | Information Disclosure | Compliance filters | medium | mitigate | Allowlisted query keys; `withCpmo` | closed |
| T-23-08 | Tampering | Audit JSON render | high | mitigate | `JSON.stringify` text in `<pre>`; no innerHTML | closed |
| T-23-09 | Information Disclosure | Audit page | high | mitigate | GET only; no PATCH/DELETE UI; `withCpmo` | closed |
| T-23-10 | Tampering | Audit VirtualRows | low | accept | Client windowing only | closed |
| T-23-11 | Tampering | Compliance VirtualRows | low | accept | Client windowing only | closed |
| T-23-SC | Tampering | npm installs | high | accept | No new packages; reuse in-repo VirtualRows | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-23-01 | T-23-10 / T-23-11 | VirtualRows does not change server row sets | gsd-security-auditor | 2026-08-28 |
| AR-23-02 | T-23-SC | Phase reused existing VirtualRows; no npm | gsd-security-auditor | 2026-08-28 |

---

## Verdict

**SECURED** — threats_open: 0
