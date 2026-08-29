# Milestone v1.0–v2.1 — Tóm tắt dự án (tiếng Việt)

**Ngày tạo:** 2026-08-29  
**Mục đích:** Onboarding đội ngũ và review toàn bộ milestone đã ship  
**Trạng thái:** ✅ Ba milestone đã ship — v1.0 (2026-08-25), v2.0 (2026-08-26), v2.1 (2026-08-29)

---

## 1. Tổng quan dự án + hành trình 3 milestone

**PM Tool B (Portfolio One View)** là ứng dụng quản lý dự án/portfolio đa tenant, xây trên Next.js 16 App Router, React 19 và PostgreSQL. Ứng dụng tích hợp import Jira Cloud, báo cáo AI qua Anthropic SDK, xuất Excel/PPT/Word/PDF, và triển khai qua Docker/GHCR, Railway và Kubernetes.

**Giá trị cốt lõi:** Một nguồn sự thật duy nhất cho projects, milestones, RAID và weekly reports — theo vai trò (CPMO / PM / Viewer) và phạm vi project — để CPMO và PM hành động dựa trên điểm nổi bật, milestone gần nhất, rủi ro/vấn đề mở, và các hạng mục cần hỗ trợ lãnh đạo.

### Hành trình ba milestone

| Milestone | Mục tiêu chính | Ship |
|-----------|----------------|------|
| **v1.0 Layer Reorg & Hardening** | Tái cấu trúc brownfield thành kiến trúc phân lớp; test ở mọi tầng; cách ly tenant; **không** thêm tính năng sản phẩm mới | 2026-08-25 |
| **v2.0 Portfolio One View** | Đưa sản phẩm tuân thủ spec GuiIT Portfolio One View tại cổng API/service: roles, L0–L5 master, RAID/milestone masters, weekly cadence, dashboard APIs, Confluence checklist, append-only audit — **giữ** Jira/AI/export | 2026-08-26 |
| **v2.1 Hardening & Deferred Debt** | Đóng nợ v1/v2 còn lại: migrate ngoài `getDb()`, route thừa, v2 UI trong `modules/*/ui/`, tách backend/UI toàn repo, Kysely trên pool hiện có, PageChrome/cold-start, nits/Nyquist/HYG-02 | 2026-08-29 |

### Bảng điểm ship

| Milestone | Phase | Plan | Yêu cầu | Audit | Ngày ship |
|-----------|-------|------|---------|-------|-----------|
| v1.0 | 8 | 35 | 54/54 | `tech_debt` | 2026-08-25 |
| v2.0 | 10 | 40 | 79/79 | `tech_debt` | 2026-08-26 |
| v2.1 | 9 | 56 | 28/28 | `passed` | 2026-08-29 |
| **Tổng** | **27** | **131** | **161/161** | v2.1 `passed` | 2026-08-07 → 2026-08-29 |

---

## 2. Kiến trúc và quyết định kỹ thuật

### Stack (không đổi — ràng buộc khóa)

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | Next.js 16.2.4, React 19.2.4 |
| Ngôn ngữ | TypeScript strict |
| Cơ sở dữ liệu | PostgreSQL qua `pg` (Kysely trên cùng pool từ v2.1) |
| Test | Vitest 4 (Node + jsdom) |
| Validation | Zod ^4.4.3 |
| Tích hợp | Jira Cloud, Anthropic SDK, Resend |
| Export | exceljs, pptxgenjs, docx, jspdf |
| Deploy | Docker standalone, GH Actions → GHCR, Railway, K8s |

**Ràng buộc khóa:** Không thay Next/React/Postgres; không ORM thứ hai; spec Word GuiIT chỉ tham chiếu local (không commit `.docx`).

### Tiến hóa kiến trúc qua ba milestone

#### (a) Sau v1.0 — phân lớp cơ bản

```
UI (hooks + feature modules)
    ↓ fetch API
Route (withAuth / withProjectAccess + Zod)
    ↓
Service (business logic, tenant check, typed errors)
    ↓
Repository (SQL + column allowlist)  |  Integration Client (Jira/Anthropic/Resend)
    ↓
PostgreSQL                              External APIs
```

- SQL tập trung trong `lib/repositories/*.repo.ts`; schema vẫn do `getDb()` sở hữu lúc đó.
- Wrapper `withAuth`, `withProjectAccess`, `withProgramAccess` là điểm enforcement duy nhất.
- Typed errors (`ForbiddenError`, `NotFoundError`, `ValidationError`) — route map sang HTTP.

#### (b) Sau v2.0 — spec API gate

- Cùng lớp trên, cộng thêm:
  - `SessionUser.roles[]` (CPMO / PM / Viewer) — **không** dùng `is_admin` làm authz sản phẩm.
  - Spec APIs dưới `lib/services` + `app/api`: weekly/fiscal/RAID/dashboard/checklist/audit.
  - Bảng mới: weekly periods, fiscal ledger, dashboard filters, document catalog, `audit_logs`.
  - `workflow.ui_phase` = false lúc closeout — **chưa** có React consumer cho dashboards/weekly/checklist/audit (ship UI ở v2.1).

#### (c) Sau v2.1 — module layout + Kysely + RSC chrome

```
app/ (thin re-exports: pages + route.ts shells)
    ↓
modules/<feature>/{backend,ui}/
    backend: services, repos (*.repo.ts + getKysely), API handlers
    ui: hooks, components, page containers
    ↓
lib/http/ wrappers  |  lib/db.ts (connect-assert-seed only)
    ↓
migrations/ + tsx migrate CLI  →  PostgreSQL (checksum ledger)
```

- **DATA:** Migrate engine checksum-ledger + `assertMigrated`; DDL rời khỏi `getDb()`.
- **ENF-02:** Mọi `*.repo.ts` query qua `getKysely` trên pool hiện có; `pickAllowed` giữ semantics mass-assignment.
- **PERF-02:** Server `PageChrome` trên route Sidebar v2; client module chỉ render nội dung.
- **MOD-01/02:** Mười feature module (`dashboards`, `weekly`, `documents`, `audit`, `projects`, `portfolio`, `reports`, `jira`, `admin`, `operations`) — URL cũ giữ qua re-export mỏng.

---

## 3. Các phase đã hoàn thành

### v1.0 — Layer Reorg & Hardening (Phase 1–8)

| Phase | Tên | Hoàn thành | Tóm tắt |
|-------|-----|------------|---------|
| 1 | Test Harness | 2026-08-07 | Vitest 4: Node unit, jsdom component, route-handler test không cần server, repo test Postgres thật, CI fail khi test fail |
| 2 | Repository Layer | 2026-08-10 | Toàn bộ SQL vào `lib/repositories/*.repo.ts`; scoping explicit; column allowlist; test read/write/reject |
| 3 | Integration Clients | 2026-08-10 | Jira/Anthropic/Resend qua client riêng; timeout; Zod validation; unified credential resolver |
| 4 | Service Layer | 2026-08-11 | Business logic + tenant check trong services; đóng 2 IDOR live; 11 portfolio routes wired; typed errors |
| 5 | Route Thinning & Validation | 2026-08-11 | `withAuth`, `withProjectAccess`, `withProgramAccess`; 17 project-tree routes; Zod trên tree-A và tree-B |
| 6 | Access Enforcement Rollout | 2026-08-25 | Shadow-mode → enforcement; 401/403 matrix test; UAT human closed; proxy finding ghi nhận |
| 7 | UI Decomposition | 2026-08-25 | 7 god page/component tách hooks + modules; component test; không client import db/repo/service |
| 8 | INTG-08 Credential Cutover | 2026-08-25 | Script verify cutover exit 0; xóa dead Jira credential blocks (HYG-01 commit `e0b2cea`) |

### v2.0 — Portfolio One View (Phase 9–18)

| Phase | Tên | Hoàn thành | Tóm tắt |
|-------|-----|------------|---------|
| 9 | Mapping Table Tenant Isolation | 2026-08-26 | `company_id` trên 4 bảng mapping (timeline, bug, JQL preset, sync); backfill; cross-company 403 |
| 10 | Users, Roles & Server Authorization | 2026-08-26 | `roles[]` authz spine; CPMO company-scoped; PM assignment interim; Viewer mutator 403; user admin |
| 11 | Project Master, PM Assignment & Stakeholders | 2026-08-26 | L0–L5 governance, unique `project_code`, PM assignment windows, stakeholder history |
| 12 | Milestone & RAID Master Registers | 2026-08-26 | RAID codes R-/I-nnn; deactivate-in-place; due-date history; upcoming/overdue helpers |
| 13 | Weekly Periods & PM Submit | 2026-08-26 | CPMO periods + obligated shells; PM draft/submit/correct; RAID writes on submit only |
| 14 | CPMO Tracking & Consolidated Export | 2026-08-26 | Period tracking counts/filters; snapshot-only xlsx/docx/pptx export pack |
| 15 | Budget, Value, ROI & Dependencies | 2026-08-26 | Fiscal ledger VND; benefits/ROI; bidirectional project dependencies |
| 16 | Portfolio & PM Dashboards | 2026-08-26 | Spec KPI APIs, AND filters, drill-downs, PM action queues — API gate, chưa UI v2 |
| 17 | Document Templates & Confluence Checklist | 2026-08-26 | Catalog, URL-only templates, checklist generation, compliance GET |
| 18 | Append-Only Audit Log | 2026-08-26 | `auditLog` INSERT-only trên mutations; CPMO GET `/api/audit` company-scoped |

### v2.1 — Hardening & Deferred Debt (Phase 19–27)

| Phase | Tên | Hoàn thành | Tóm tắt |
|-------|-----|------------|---------|
| 19 | Data Layer Cutover | 2026-08-28 | Migrate checksum-ledger + tsx CLI; regenerate `migrations/0001`; `getDb()` connect-assert-seed only |
| 20 | API Contract & Leftover Routes | 2026-08-28 | Proxy JSON 401; Jira search hygiene; ESLint ENF-01; ops/admin/config qua services; D-23 giữ nguyên |
| 21 | Portfolio & PM Dashboard Pages | 2026-08-28 | Spec dashboard UI tại `/dashboards/portfolio` và `/dashboards/pm` trong `modules/dashboards/ui/` |
| 22 | Weekly Workflow Surfaces | 2026-08-28 | CPMO periods/tracking/export + PM weekly editor; VirtualRows in-repo (PERF-01) |
| 23 | Document Checklist & Audit Viewer | 2026-08-28 | Catalog/compliance UI + PM checklist + CPMO audit viewer với before/after JSON |
| 24 | Repo-wide Module Split | 2026-08-28 | Mười feature module `backend/` + `ui/`; thin `app/` re-exports (MOD-01/02) |
| 25 | Kysely Repositories | 2026-08-29 | Toàn bộ `*.repo.ts` trên `getKysely`; `pickAllowed`; xóa `buildUpdate` helper |
| 26 | RSC Chrome & Cold Start | 2026-08-29 | Server `PageChrome` trên Sidebar routes v2; cold-start p95 budget ghi nhận |
| 27 | Nits, Validation & Operator Gate | 2026-08-29 | No-op milestone audit skip; Nyquist VALIDATION.md; HYG-02 502 accepted; contract tests NIT-01 |

**Timeline tổng:** 2026-08-07 → 2026-08-29 (~22 ngày)

---

## 4. Phủ sóng yêu cầu

### v1.0 — 54/54 ✅

Chi tiết: `.planning/milestones/v1.0-REQUIREMENTS.md`  
**Audit:** `tech_debt` — tất cả yêu cầu thỏa mãn; nợ kỹ thuật ghi nhận cho milestone sau.

| Nhóm | ID | Trạng thái |
|------|-----|------------|
| Test Harness | TEST-01..05 | ✅ 5/5 |
| Repository | REPO-01..06 | ✅ 6/6 |
| Integration | INTG-01..10 | ✅ 10/10 |
| Service | SVC-01..07 | ✅ 7/7 |
| Route | ROUTE-01..12 | ✅ 12/12 |
| UI | UI-01..11 | ✅ 11/11 |
| Cross-cutting | HYG-01..03 | ✅ Áp dụng xuyên suốt |

### v2.0 — 79/79 ✅

Chi tiết: `.planning/milestones/v2.0-REQUIREMENTS.md`  
**Audit:** `tech_debt` — API/service gate hoàn chỉnh; UI React consumer và nợ v1 còn lại được v2.1 đóng.

| Nhóm | ID (tóm tắt) | Trạng thái |
|------|--------------|------------|
| Tenant | TENANT-01 | ✅ 1/1 |
| Users | USER-01..06 | ✅ 6/6 |
| Auth | AUTH-01..06 | ✅ 6/6 |
| Project | PROJ-01..08 | ✅ 8/8 |
| PM Assignment | PMAS-01..04 | ✅ 4/4 |
| Stakeholders | STKH-01..03 | ✅ 3/3 |
| Milestones | MS-01..05 | ✅ 5/5 |
| RAID | RAID-01..06 | ✅ 6/6 |
| Weekly Periods | PERD-01..03 | ✅ 3/3 |
| Weekly Submit | WKRP-01..06 | ✅ 6/6 |
| CPMO Tracking | CPMO-01..04 | ✅ 4/4 |
| Dependencies | DEP-01..03 | ✅ 3/3 |
| Budget | BUDG-01..06 | ✅ 6/6 |
| Portfolio Dashboard | PDSH-01..06 | ✅ 6/6 |
| PM Dashboard | MDSH-01..05 | ✅ 5/5 |
| Documents | DOC-01..06 | ✅ 6/6 |
| Audit | AUDIT-01 | ✅ 1/1 |

### v2.1 — 28/28 ✅

Chi tiết: `.planning/milestones/v2.1-REQUIREMENTS.md`  
**Audit:** `passed` — milestone archive an toàn.

| Nhóm | ID (tóm tắt) | Trạng thái |
|------|--------------|------------|
| Module layout | MOD-01..02 | ✅ 2/2 |
| Data layer | DATA-01..03 | ✅ 3/3 |
| Proxy | PROXY-01 | ✅ 1/1 |
| Jira hygiene | JIRA-01 | ✅ 1/1 |
| Enforcement | ENF-01..02 | ✅ 2/2 |
| Route thinning | THIN-01 | ✅ 1/1 |
| Dashboard UI | PDSH-07, MDSH-06, NIT-04 | ✅ 3/3 |
| Weekly UI | PERD-04, WKRP-07, CPMO-05, PERF-01 | ✅ 4/4 |
| Document UI | DOC-07..09 | ✅ 3/3 |
| Audit UI | AUDIT-02 | ✅ 1/1 |
| Performance | PERF-02..03 | ✅ 2/2 |
| Nits | NIT-01..03 | ✅ 3/3 |
| Nyquist | NYQ-01 | ✅ 1/1 |
| Operator | HYG-02 | ✅ 1/1 |

**Tổng hợp:** **161/161** yêu cầu qua ba milestone — v1.0 và v2.0 audit `tech_debt` (nợ đã được v2.1 xử lý hoặc chấp nhận); v2.1 audit `passed`.

---

## 5. Quyết định quan trọng

| Quyết định | Lý do | Milestone/Phase |
|------------|-------|-----------------|
| Reorg layer trước khi fix từng concern | Auth copy-paste trên codebase cũ sẽ bị route mới bỏ qua | v1.0 / toàn milestone |
| Full stack gồm UI, không chỉ backend | God page cũng là “mess” ngang route | v1.0 / Phase 7 |
| Sweep layer-by-layer thay vì incremental per-feature | Giảm số trạng thái nửa-vời đồng thời tồn tại | v1.0 |
| Security ưu tiên trong các concern | IDOR và mass-assignment SQL là lỗ hổng tenant isolation thực | v1.0 / Phase 4–6 |
| Test cùng reorg, không build safety net trước | Snapshot contract trên endpoint sắp di chuyển chỉ encode mess cũ | v1.0 / Phase 1 |
| INTG-08 evidence trước khi xóa dead code | Tránh xóa path credential khi chưa verify per-tenant | v1.0 / Phase 8 |
| Spec GuiIT là source of truth cho v2.0 | Yêu cầu nghiệp vụ ngân hàng là sản phẩm; giữ Jira/AI/export | v2.0 |
| `roles[]` không phải `is_admin` cho authz sản phẩm | `is_admin` chỉ cho platform break-glass còn lại | v2.0 / Phase 10 |
| D-23 ops/admin carve-out | `operations/**` và `/api/admin/companies` giữ session+tenant, không `withCpmo` | v2.0 / Phase 10; v2.1 / Phase 20 |
| DATA-01..03 một task Phase 19 | Origin branch đã ship cùng nhau; tách ba phase thêm ceremony | v2.1 / Phase 19 |
| Replay origin migrate pattern, không merge branch | Baseline v1.0-era thiếu bảng v2.0; regenerate `0001` từ schema hiện tại | v2.1 / Phase 19 |
| Proxy JSON 401 qua prefix `/api/` | Accept-header detection có thể 401 HTML navigation gửi JSON | v2.1 / Phase 20 / PROXY-01 |
| ENF-01 allowlist file | Comment exemption drift; posix path list là carve-out D-23 | v2.1 / Phase 20 |
| Repo-wide `modules/<feature>/{backend,ui}` | Không chỉ màn v2 mới — mọi feature area tách backend/UI | v2.1 / Phase 24 / MOD-01 |
| Kysely trên pool hiện có | Compile-time column safety; không Prisma/ORM thứ hai | v2.1 / Phase 25 / ENF-02 |
| Giữ Jira / AI / Excel-PPT-Word export | Spec không thay thế; vẫn là differentiator | v2.0–v2.1 |
| Giữ `audit_logs` + INSERT-only `auditLog` | Không dual-write bảng thứ hai | v2.0 / Phase 18 |
| RAID `entity_type` stays `risk` / `issue` | Không invent unified `raid` string | v2.0 / Phase 18 |
| HYG-02 Anthropic 502 accepted | Malformed output → 502 thay vì 500; operator confirm Phase 27 | v2.1 / Phase 27 |
| In-repo VirtualRows, không npm mới | PERF-01 ~100+ rows | v2.1 / Phase 22 |
| Spec dashboard pages chỉ consume Phase 16 APIs | Không mix `/api/portfolio` hay ghi đè `/` | v2.1 / Phase 21 |

---

## 6. Nợ kỹ thuật còn lại

### (A) Đã đóng bởi milestone sau — không còn mở từ audit v1.0/v2.0

| Hạng mục audit cũ | Đóng tại |
|-------------------|----------|
| 4 bảng mapping thiếu `company_id` | Phase 9 / TENANT-01 (v2.0) |
| Ops/admin/config/import-mapping gọi repo trực tiếp | Phase 20 / THIN-01 (v2.1) |
| Proxy HTML 307 cho API caller | Phase 20 / PROXY-01 (v2.1) |
| Jira search dump log / unguarded `req.json()` | Phase 20 / JIRA-01 (v2.1) |
| Dashboards/weekly/checklist/audit không có React consumer | Phases 21–23 (v2.1) |
| DATA/ENF/PERF pack hoãn | Phases 19, 20, 22, 25, 26 (v2.1) |
| HYG-02 Anthropic 502 cần operator confirm | Phase 27 / HYG-02 accepted (v2.1) |
| Nyquist VALIDATION.md còn `draft` | Phase 27 / NYQ-01 (v2.1) |
| No-op milestone PATCH ghi audit noise | Phase 27 / NIT-02 (v2.1) |
| v1 `budget_items` vs fiscal ledger | Phase 27 / NIT-03 documented (v2.1) |
| Migrate trong `getDb()` boot path | Phase 19 / DATA-01..03 (v2.1) |
| Repositories chưa Kysely | Phase 25 / ENF-02 (v2.1) |

### (B) Vẫn chấp nhận sau v2.1 closeout

Theo `v2.1-MILESTONE-AUDIT.md` — **không** chặn archive; bước tiếp theo là `/gsd-new-milestone`, không phải milestone “leftover debt” trừ khi team mở mới.

| Hạng mục | Ghi chú |
|----------|---------|
| D-23 leftover | `operations/**` và `/api/admin/companies` vẫn session+tenant; THIN-01/ENF-01 honor carve-out — **không phải miss v2.1** |
| PageChrome + inner `100vh` | Milestones/Timeline có thể double-scroll trong PageChrome main |
| `listOpenProjectDependencies` | Locked bởi contract test + repo; chưa có dashboard consumer (NIT-01 / D-01) |
| `snapshotsEqual` local copy | Trong `milestones.service` — plan lock; không shared helper với `projects.service` |

---

## 7. Bắt đầu / onboarding

### Chạy dự án

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest
npm run build        # Next.js production build
npm run migrate      # Áp dụng migrations (checksum ledger) — trước server trong Docker/CI/K8s
```

**Biến môi trường bắt buộc:** `DATABASE_URL` (PostgreSQL). Tùy chọn: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, Jira env vars theo cấu hình company.

### Đường dẫn quan trọng (cập nhật sau v2.1)

| Đường dẫn | Vai trò |
|-----------|---------|
| `modules/<feature>/backend/` | Services, repos (`getKysely`), logic domain theo feature |
| `modules/<feature>/ui/` | Pages, hooks, components (dashboards, weekly, documents, audit, projects, …) |
| `app/` | Thin re-exports — pages và `app/api/**/route.ts` shells giữ URL cũ |
| `lib/http/` | `withAuth`, `withProjectAccess`, `withCpmo`, error mapping |
| `lib/db.ts` | Connect, assert migrated, seed only — **không** DDL boot |
| `migrations/` + tsx migrate CLI | Schema versioned; chạy trước app start (Docker/K8s/Railway) |
| `lib/repositories/*.repo.ts` | SQL qua Kysely + `pickAllowed` |
| `.planning/milestones/` | Archive v1.0, v2.0, v2.1 (ROADMAP, REQUIREMENTS, AUDIT) |
| `.planning/reports/MILESTONE_SUMMARY-v1.0-vi.md` | Báo cáo onboarding **chỉ v1.0** (sibling — không thay thế bởi file này) |

### Quy ước khi thêm code mới

1. **Route project-scoped:** Wrapper (`withProjectAccess` / `withCpmo`) → service trong `modules/*/backend/` → **không** SQL trực tiếp trong route.
2. **SQL mới:** Chỉ trong `*.repo.ts` qua `getKysely`; PATCH qua `pickAllowed`.
3. **UI mới:** Đặt trong `modules/<feature>/ui/`; re-export mỏng tại `app/`; **không** client import db/repo/service.
4. **External API:** Qua integration client + credential resolver.
5. **Tenant isolation:** Không tùy chọn — mọi path project-scoped assert company access.
6. **Schema change:** Versioned SQL trong `migrations/`; chạy migrate job; không thêm DDL vào `getDb()`.

### Tài liệu tham khảo

- `.planning/PROJECT.md` — mô tả dự án, constraints, Key Decisions
- `.planning/MILESTONES.md` — tóm tắt ship ba milestone
- `.planning/milestones/v1.0-*`, `v2.0-*`, `v2.1-*` — archive chi tiết
- `.planning/reports/MILESTONE_SUMMARY-v1.0-vi.md` — onboarding v1.0-only (giữ nguyên)

### Bước tiếp theo

Chạy `/gsd-new-milestone` khi sẵn sàng mở chu kỳ sản phẩm mới.

---

## Thống kê

| Chỉ số | Giá trị |
|--------|---------|
| Timeline | 2026-08-07 → 2026-08-29 |
| Phase | 27/27 hoàn thành |
| Plan | 131/131 |
| Yêu cầu | 161/161 (54 + 79 + 28) |
| Audit v1.0 | `tech_debt` — archived |
| Audit v2.0 | `tech_debt` — archived (UI debt closed v2.1) |
| Audit v2.1 | `passed` — archived |
| Commits (2026-08-07 → 2026-08-30) | ~1078 |
| Contributors | thienpv, hieunm1902 |

---

*Tài liệu được tạo từ archive milestone v1.0, v2.0 và v2.1. Báo cáo sibling chỉ v1.0: `.planning/reports/MILESTONE_SUMMARY-v1.0-vi.md`.*
