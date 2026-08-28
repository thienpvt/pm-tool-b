# Milestone v1.0 — Tóm tắt dự án (tiếng Việt)

**Ngày tạo:** 2026-08-25  
**Mục đích:** Onboarding đội ngũ và review milestone  
**Trạng thái:** ✅ Đã ship — 8/8 phase, 54/54 yêu cầu

---

## 1. Tổng quan dự án

**PM Tool B (Portfolio One View)** là ứng dụng quản lý dự án/portfolio đa tenant, xây trên Next.js 16 App Router, React 19 và PostgreSQL. Ứng dụng hỗ trợ import Jira, báo cáo AI (Anthropic), xuất Excel/PPT/Word/PDF, và triển khai qua Docker/GHCR, Railway và Kubernetes.

**Milestone v1.0 — Layer Reorg & Hardening** không thêm tính năng sản phẩm mới. Mục tiêu là tái cấu trúc codebase brownfield từ trạng thái “mess” (SQL inline trong route, auth copy-paste, trang god component 2000+ dòng, không có test) thành kiến trúc phân lớp rõ ràng với test ở mọi tầng và cách ly tenant an toàn.

**Giá trị cốt lõi:** Mọi request theo phạm vi project phải được cách ly theo tenant, và mỗi tầng chỉ làm một việc — để route hoặc trang mới không thể âm thầm tái giới thiệu lỗ hổng IDOR hoặc god component.

**Kết quả ship (2026-08-25):**

- 8 phase, 35 plan hoàn thành
- 727 test Vitest đang pass
- 54/54 yêu cầu v1.0 đạt
- Audit milestone: `tech_debt` (nợ kỹ thuật được ghi nhận, không chặn archive)

---

## 2. Kiến trúc và quyết định kỹ thuật

### Stack (không đổi)

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | Next.js 16.2.4, React 19.2.4 |
| Ngôn ngữ | TypeScript strict |
| Cơ sở dữ liệu | PostgreSQL qua `pg` |
| Test | Vitest 4 (Node + jsdom) |
| Validation | Zod ^4.4.3 |
| Tích hợp | Jira Cloud, Anthropic SDK, Resend |
| Export | exceljs, pptxgenjs, docx, jspdf |
| Deploy | Docker standalone, GH Actions → GHCR |

### Kiến trúc phân lớp (sau v1.0)

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

### Quyết định kiến trúc quan trọng

- **Sweep bottom-up theo dependency:** Test harness → Repository → Integration → Service → Route → Enforcement → UI → Cutover credential. Không đảo thứ tự.
- **Tách enforcement thành 2 phase (5 + 6):** Phase 5 xây wrapper; Phase 6 rollout shadow-mode trước khi bật 403 cứng — tránh “403 storm”.
- **HYG-01:** Commit di chuyển code thuần túy tách khỏi commit thay đổi hành vi — dễ bisect regression.
- **HYG-02:** Mọi sửa bug trong quá trình refactor phải ghi rõ trong commit message.
- **HYG-03:** Một tầng chỉ được coi là xong khi test tồn tại và pass.
- **Typed errors không mang HTTP status:** `ForbiddenError`, `NotFoundError`, `ValidationError` — route/wrapper map sang 403/404/400.
- **Một credential resolver thống nhất:** Thay thế pattern Jira (env-var-names-in-DB) và Anthropic (env-then-DB) cũ.
- **Column allowlist trên mọi write path:** Chặn mass-assignment SQL qua `Object.keys(body)`.
- **God page → container + hooks + `_components/`:** Giới hạn 400 dòng/file.

---

## 3. Các phase đã hoàn thành

| Phase | Tên | Hoàn thành | Tóm tắt |
|-------|-----|------------|---------|
| 1 | Test Harness | 2026-08-07 | Vitest 4: Node unit, jsdom component, route-handler test không cần server, repo test với Postgres thật, CI fail khi test fail |
| 2 | Repository Layer | 2026-08-10 | Toàn bộ SQL vào `lib/repositories/*.repo.ts`; scoping explicit; column allowlist; test read/write/reject |
| 3 | Integration Clients | 2026-08-10 | Jira/Anthropic/Resend qua client riêng; timeout; Zod validation; unified credential resolver; test mock + malformed response |
| 4 | Service Layer | 2026-08-11 | Business logic + tenant check trong services; đóng 2 IDOR live; 11 portfolio routes wired; typed errors |
| 5 | Route Thinning & Validation | 2026-08-11 | `withAuth`, `withProjectAccess`, `withProgramAccess`; 17 project-tree routes converted; Zod trên tree-A và tree-B |
| 6 | Access Enforcement Rollout | 2026-08-25 | Shadow-mode → enforcement; 401/403 matrix test; UAT human closed; proxy.ts finding ghi nhận |
| 7 | UI Decomposition | 2026-08-25 | 7 god page/component tách thành hooks + modules; component test; không client import db/repo/service |
| 8 | INTG-08 Credential Cutover | 2026-08-25 | Script verify cutover exit 0; xóa dead Jira credential blocks (HYG-01 commit `e0b2cea`) |

**Thời gian:** 2026-08-07 → 2026-08-25 (~18 ngày)  
**Commits (từ 2026-08-07):** ~249  
**Contributors:** hieunm1902, thienpv

---

## 4. Phủ sóng yêu cầu

**Tổng: 54/54 ✅** — chi tiết trong `.planning/milestones/v1.0-REQUIREMENTS.md`

| Nhóm | ID | Trạng thái |
|------|-----|------------|
| Test Harness | TEST-01..05 | ✅ 5/5 |
| Repository | REPO-01..06 | ✅ 6/6 |
| Integration | INTG-01..10 | ✅ 10/10 |
| Service | SVC-01..07 | ✅ 7/7 |
| Route | ROUTE-01..12 | ✅ 12/12 |
| UI | UI-01..11 | ✅ 11/11 |
| Cross-cutting | HYG-01..03 | ✅ Áp dụng xuyên suốt |

**Audit verdict:** `tech_debt` — tất cả yêu cầu v1.0 thỏa mãn; nợ kỹ thuật còn lại được ghi nhận cho milestone tiếp theo.

**Luồng E2E đã verify (9/9):** Auth session, Risks CRUD, cross-company 403, portfolio home, báo cáo/AI/email, project report/timeline/milestones/roadmap, Jira + import.

---

## 5. Nhật ký quyết định chính

| Quyết định | Lý do | Phase |
|------------|-------|-------|
| Reorg layer trước khi fix từng concern | Auth copy-paste trên codebase cũ sẽ bị route mới bỏ qua | Toàn milestone |
| Full stack gồm UI, không chỉ backend | God page cũng là “mess” ngang route | 7 |
| Sweep layer-by-layer thay vì incremental per-feature | Giảm số trạng thái nửa-vời đồng thời tồn tại | Toàn milestone |
| Security ưu tiên trong các concern | IDOR và mass-assignment SQL là lỗ hổng tenant isolation thực | 4–6 |
| Test cùng reorg, không build safety net trước | Snapshot contract trên endpoint sắp di chuyển chỉ encode mess cũ | 1 |
| INTG-08 evidence trước khi xóa dead code | Tránh xóa path credential khi chưa verify per-tenant | 8 |
| Anthropic malformed output → 502 (không 500) | INTG-06 cấm 500 cho shape mismatch | 3 |
| `assertProjectAccess` trả về project row (không void) | Mirror `assertProgramAccess`; handler có row sẵn | 5 |
| Portfolio RAG inline extract verbatim | Reconcile vs `calculateRAG` là HYG-02 | 4 |
| Decomposition giữ nguyên behavior | Behavior freeze trừ security change có chủ đích | 7 |

---

## 6. Nợ kỹ thuật và hạng mục hoãn

### Nợ kỹ thuật đã ghi nhận (không chặn v1.0)

**Tích hợp & route còn lại:**
- Một số route operations/admin/config/import-mapping vẫn gọi repo trực tiếp (SVC-01 / ROUTE-05 remainder)
- AI/report/multipart routes dùng `rawBody` thay vì Zod body schema (ROUTE-06 remainder)
- `app/api/resources/route.ts` vẫn dùng `String(e)` (ROUTE-07 leak)

**Proxy & auth:**
- `proxy.ts` trả HTML 307 cho API caller không có cookie — chưa chuyển sang JSON 401
- Jira search/fields: 401 thiếu session có thể trông giống “config chưa set”

**UI:**
- Một số hooks gán JSON response khi 401/403 như dataset (fragile error path)
- Project-report send-email post tới portfolio route (session-only, không `withProjectAccess`)

**Jira search (pre-existing):**
- `console.log` dump custom fields
- `req.json()` không guard — body malformed có thể 500
- `extraFields` chưa validate `string[]`

**Operator cần xác nhận:**
- HYG-02: Anthropic malformed output trên 3 report route giờ trả 502 thay vì 500 — xác nhận không có dashboard/alert key off status 500 cũ

**Schema DB (v2 follow-up):**
- 4 bảng chưa có `company_id`: `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings`

### Hoãn sang milestone sau (đã track)

| Hạng mục | Ghi chú |
|----------|---------|
| DATA-01..03 | Migration tooling |
| ENF-01..02 | ESLint gate, Kysely adoption |
| PERF-01..03 | Performance (virtualization, server components) |
| Migrations ra khỏi `getDb()` | Cold-start chậm, không phải rủi ro correctness |

---

## 7. Bắt đầu làm việc với codebase

### Chạy dự án

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest — 727 tests
npm run build        # Next.js production build
```

### Thư mục quan trọng

| Đường dẫn | Vai trò |
|-----------|---------|
| `app/` | Pages và API routes (App Router) |
| `app/api/projects/[id]/` | Project-scoped API — đã bọc `withProjectAccess` |
| `lib/repositories/` | SQL duy nhất được phép (ngoài `lib/db.ts`) |
| `lib/services/` | Business logic, tenant check |
| `lib/integrations/` | Jira, Anthropic, Resend clients |
| `lib/http/` | `withAuth`, `withProjectAccess`, error mapping |
| `components/` | UI shared; timeline import dialog đã decompose |
| `.planning/milestones/` | Archive v1.0 (ROADMAP, REQUIREMENTS, AUDIT) |

### Quy ước khi thêm code mới

1. **Route mới theo project:** Bọc `withProjectAccess` → gọi service → không SQL/ fetch trực tiếp
2. **SQL mới:** Chỉ trong `*.repo.ts`, có column allowlist
3. **External API:** Chỉ qua integration client + credential resolver
4. **UI page mới:** Tách hook fetch + component; không import `@/lib/db` / repo / service từ client
5. **Test:** Mọi layer mới cần test; cross-company 403 cho path project-scoped

### Tài liệu tham khảo

- `.planning/PROJECT.md` — mô tả dự án và constraints
- `.planning/milestones/v1.0-ROADMAP.md` — chi tiết 8 phase
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — audit và tech debt
- `AGENTS.md` — lưu ý Next.js 16 breaking changes

### Bước tiếp theo cho dự án

Chạy `$gsd-new-milestone` để lập kế hoạch v2. Các hướng ưu tiên có thể gồm: service-layer cho admin/ops routes còn lại, proxy JSON 401, xác nhận operator về Anthropic 502, thêm `company_id` cho 4 bảng import mapping.

---

## Thống kê

| Chỉ số | Giá trị |
|--------|---------|
| Timeline | 2026-08-07 → 2026-08-25 |
| Phase | 8/8 hoàn thành |
| Plan | 35/35 |
| Yêu cầu | 54/54 |
| Test | 727 passing (Vitest) |
| Commits (từ 2026-08-07) | ~249 |
| Contributors | hieunm1902, thienpv |
| Audit | tech_debt — safe to archive |

---

*Tài liệu được tạo tự động từ artifact milestone v1.0. Phiên bản tiếng Anh có thể được tạo tại `MILESTONE_SUMMARY-v1.0.md` nếu cần.*
