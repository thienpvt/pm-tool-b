# Codebase Snapshot — PM Tool (Gambaru)

> **Đọc file này thay vì khám phá lại codebase.** Cập nhật phần liên quan sau mỗi lần thay đổi đáng kể.
> Last updated: 2026-05-08

---

## 1. Tổng quan kiến trúc

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js App Router (v16.2.4) |
| Language | TypeScript, React 19 |
| Database | PostgreSQL (via `pg` library, không dùng ORM) |
| Styling | Tailwind CSS v4 + shadcn/ui (base-nova style) |
| Auth | Session-based (scrypt hash, cookie `pm_session`, 7 ngày) |
| AI | Anthropic Claude SDK (`@anthropic-ai/sdk`) |
| Exports | ExcelJS, PptxGenJS, Docx |
| Deploy | Railway + Dockerfile |

**Không dùng:** Prisma, Redux, tRPC, GraphQL, NextAuth.

---

## 2. Cấu trúc thư mục

```
pm-tool/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Portfolio dashboard (trang chính sau login)
│   ├── login/page.tsx      # Trang đăng nhập
│   ├── admin/page.tsx      # Admin: users + companies
│   ├── customers/page.tsx  # Quản lý khách hàng
│   ├── resources/page.tsx  # Resource overview
│   ├── portfolio/report/   # AI portfolio analysis
│   ├── projects/
│   │   ├── page.tsx        # Danh sách project
│   │   ├── new/page.tsx    # Tạo project mới
│   │   └── [id]/
│   │       ├── page.tsx           # Project detail
│   │       ├── dashboard/         # KPIs
│   │       ├── timeline/          # Activities timeline
│   │       ├── resources/         # Resource planning
│   │       ├── communication/     # Meetings + escalations
│   │       ├── risks/             # Risk & issue register
│   │       ├── analysis/          # Delay analysis
│   │       ├── reports/           # Weekly reports
│   │       └── documents/         # Document management
│   └── api/                # API routes (xem mục 6)
├── components/
│   ├── layout/Sidebar.tsx          # Nav sidebar + user menu
│   ├── onboarding/OnboardingModal.tsx  # 4-step wizard
│   ├── timeline/ImportMappingDialog.tsx
│   ├── PhaseTracker.tsx            # Phase progress tracker
│   └── ui/                         # shadcn components (17 files)
├── lib/
│   ├── db.ts               # PostgreSQL client + schema init
│   ├── auth.ts             # Auth utilities
│   ├── utils.ts            # cn() helper
│   └── export/
│       ├── excel.ts        # ExcelJS exporter
│       ├── ppt.ts          # PptxGenJS exporter
│       └── word.ts         # Docx exporter
├── proxy.ts                # Auth middleware
├── next.config.ts
├── railway.json
└── Dockerfile
```

---

## 3. Database Schema (PostgreSQL)

Không dùng migrations file — schema được init trong `lib/db.ts:initSchema()`.

| Bảng | Mô tả | Key columns |
|---|---|---|
| `companies` | Multi-tenant tổ chức | id, name (UNIQUE) |
| `users` | Tài khoản người dùng | id, username, password_hash, company_id, is_admin, onboarding_completed |
| `sessions` | Session management | id (TEXT PK), user_id, expires_at |
| `settings` | Key-value config | key (PK), value |
| `customers` | Khách hàng | id, name, industry, contact_*, company_id |
| `projects` | Dự án | id, name, client, pm_name, start_date, end_date, status, current_phase, customer_id, company_id |
| `activities` | Task/phase của project | id, project_id, phase, no, activity, deliverable, accountable, responsible, support, plan_start/end, actual_start/end, status, completion_pct, delay_owner, delay_reason, notes, order_idx |
| `team_members` | Thành viên nhóm | id, project_id, domain, role, name, capacity_json |
| `meetings` | Cuộc họp | id, project_id, name, frequency, content, participants, method, type |
| `escalation_levels` | Quy trình leo thang | id, project_id, level, level_name, channel, participants |
| `risks` | Rủi ro | id, project_id, risk_id, description, category, owner, mitigation, status, priority, impact |
| `issues` | Vấn đề | (tương tự risks) |
| `documents` | Tài liệu | id, project_id, type, title, content_json |
| `project_holidays` | Ngày nghỉ theo project | id, project_id, date, name |
| `timeline_import_mappings` | Cấu hình import | id, name, mappings_json |

---

## 4. Authentication & Middleware

- **File:** `proxy.ts` (exported as Next.js middleware config)
- **Cookie:** `pm_session`
- **Hash:** scrypt (16-byte salt, 64-byte hash, timing-safe compare)
- **Public routes:** `/login`, `/api/auth/*`, `/api/health`
- **Protected:** mọi route khác → redirect `/login` nếu không có session

Auth utilities (`lib/auth.ts`):
- `hashPassword(password)` → `salt:hash`
- `verifyPassword(password, stored)` → boolean
- `createSession(userId)` → sessionId
- `deleteSession(sessionId)`
- `getSessionUser(req)` → User | null

---

## 5. Environment Variables

| Variable | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | ✅ | Claude API (portfolio reports) |
| `PORT` | ❌ | Default 3000 |
| `NODE_ENV` | ❌ | development/production |

---

## 6. API Routes

### Auth
- `POST /api/auth/login` — đăng nhập, tạo session
- `POST /api/auth/logout` — xóa session
- `GET /api/auth/me` — lấy user hiện tại
- `POST /api/auth/change-password`
- `POST /api/auth/complete-onboarding`

### Admin
- `GET/POST /api/admin/companies`
- `GET/POST /api/admin/users`

### Customers
- `GET/POST /api/customers`
- `GET/PUT/DELETE /api/customers/[id]`

### Projects
- `GET/POST /api/projects`
- `GET/PUT/DELETE /api/projects/[id]`
- `GET/POST /api/projects/[id]/activities`
- `GET/POST /api/projects/[id]/team`
- `GET/POST /api/projects/[id]/meetings`
- `GET/POST /api/projects/[id]/risks`
- `GET/POST /api/projects/[id]/issues`
- `GET/POST /api/projects/[id]/escalations`
- `GET/POST /api/projects/[id]/documents`
- `GET/POST /api/projects/[id]/holidays`
- `POST /api/projects/[id]/report` — generate report

### Export
- `POST /api/export/excel/[id]` — Excel project plan
- `POST /api/export/ppt/[id]` — PowerPoint kickoff
- `POST /api/export/word/[id]/[type]` — Word document
- `POST /api/export/resource-plan/[id]` — Excel resource plan
- `POST /api/export/weekly-report/[id]` — Excel weekly report

### Import
- `POST /api/import/resource-plan/[id]`
- `POST /api/parse-file-headers` — parse Excel/CSV headers
- `GET/POST /api/import-mapping`
- `GET/PUT/DELETE /api/import-mapping/[id]`

### Portfolio & Others
- `GET /api/portfolio` — portfolio overview
- `POST /api/portfolio/report` — AI report (Claude)
- `GET /api/resources`
- `GET /api/config`
- `GET /api/health` — Railway health check

---

## 7. Key Libraries & Patterns

### lib/db.ts
- `DbClient` interface: `get()`, `all()`, `run()`, `exec()`
- Tự convert `?` placeholders → `$1, $2` (SQLite → PostgreSQL compat)
- `initSchema()` chạy khi app start, tạo tất cả tables + migrations
- Connection pool: `pg.Pool`

### lib/auth.ts
- `getSessionFromRequest(req)` → đọc cookie `pm_session`
- Session expire: 7 ngày từ lúc tạo

### Export pattern
- Tất cả exports là server-side only (serverExternalPackages trong next.config.ts)
- API nhận `project_id`, query DB, tạo buffer, trả về file download

### AI pattern (portfolio report)
- `POST /api/portfolio/report` → gọi Anthropic SDK
- Stream response hoặc one-shot generation

---

## 8. Frontend Patterns

- **No global state manager** — mỗi page fetch data riêng bằng `useEffect` + `fetch()`
- **Toast notifications:** Sonner (`components/ui/sonner.tsx`)
- **Theme:** next-themes (light/dark)
- **Icons:** Lucide React
- **Chart:** Recharts
- **Form:** HTML native form + controlled components (không dùng react-hook-form)
- **shadcn components:** badge, button, card, dialog, input, label, select, separator, sheet, table, tabs, textarea

---

## 9. Deployment

- **Platform:** Railway (xem `railway.json`)
- **DB:** Railway PostgreSQL
- **Build:** Dockerfile → `node:20-slim` → `npm install` + `npm run build`
- **Health check:** `GET /api/health`
- **Restart:** ON_FAILURE

---

## 10. Tính năng chính

1. **Multi-tenant:** Mỗi company có data riêng biệt (company_id filter)
2. **Project lifecycle:** Initiation → Planning → Execution → Closing (PhaseTracker)
3. **Timeline:** Activities với plan/actual dates, completion%, delay tracking
4. **Resources:** Team capacity theo tuần (capacity_json)
5. **Communication:** Meetings + escalation levels
6. **Risk/Issue register:** Categorized, owner, mitigation, status
7. **Exports:** Excel (plan + resource), PPT (kickoff), Word (documents), Weekly report
8. **Import (Timeline):** Flexible column-mapping import — 3 bước: Upload → Map → Preview & Import
   - Hỗ trợ `.xlsx`, `.xls`, `.csv`, `.txt`
   - Auto-detect header row (bỏ qua dòng trống đầu file)
   - Giao diện 2 panel: trái = cột file (+ sample data), phải = 17 trường timeline nhóm theo 6 category (Basic/Assignees/Dates/Progress/Delay/Notes)
   - Right panel: mỗi trường có group header màu, progress counter per group, sample value preview ngay dưới dropdown (auto-convert hiển thị strikethrough gốc → resolved)
   - Auto-suggest mapping dựa trên tên cột (EN + VI không dấu)
   - **Date normalization:** DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, Excel serial → YYYY-MM-DD
   - **Fuzzy enum matching:** "Inprogress"→"In Progress", "todo"→"To-do", "dev"→"Development", "na"→"N/A", v.v.
   - Lưu/load mapping template (`timeline_import_mappings` table) để tái sử dụng
   - Step 3 preview highlight ô được auto-convert (màu vàng + hiện giá trị gốc)
9. **AI Portfolio:** Claude-powered cross-project analysis
10. **Onboarding:** 4-step wizard cho user mới (Welcome → Customer → Project → Done)

---

## CHANGELOG

| Date | Change |
|---|---|
| 2026-06-10 | Portfolio Report: (1) Fix Epic counting — activities now grouped by parent EPIC's name (`no='EPIC'` + `parent_id`) instead of `phase`, restoring correct Epic count per project after timeline refactor; (2) Bug Report section added to both HTML and text reports — positioned before Resource Allocation; shows total bugs KPI cards, status donut chart, priority donut chart, and stacked bar chart by project (bars divided by status). `bugStats` data added to `GET /api/portfolio/report` response. |
| 2026-06-09 | Bug Tracking feature: `bugs` table (project_id, issue_type, issue_key, issue_id, summary, assignee, reporter, priority, status, resolution, created) + `bug_import_mappings` (max 5 templates); API `/api/projects/[id]/bugs` (GET/POST replace-mode/DELETE) + `/api/bug-import-mapping` (GET/POST/DELETE); `BugImportDialog` 3-step import wizard (file upload or paste, column mapping with auto-suggest, preview); `/projects/[id]/bugs` page: Summary tab (active-bug table, Severity pie, Status pie, Ready-for-Test KPI, New-Today KPI) + List tab (50/page, filter Status+Priority); Sidebar: Bug Tracking nav added under Project. |
| 2026-05-28 | Portfolio Resource Management overhaul: (1) `member_category` ('delivery'/'overhead') added to `portfolio_members`; (2) "Nhân sự trong khối" tab splits into Delivery/Overhead sub-tabs; Delivery tab shows Programs count per member; (3) Replace Đã phân bổ/Còn lại bar with 3 FTE KPI cards — % Delivery, % Overhead, % Bench (formula-based); (4) Program allocations table: column renamed Định biên → Số FTE phân bổ; new Số FTE thực tế column (sum of program_project_allocations per program); Add dialog label renamed; (5) Add member dialog adds Phân loại (Delivery/Overhead) dropdown for internal members. |
| 2026-05-28 | Resource Allocation Hierarchy: Portfolio → Program → Project. (1) 2 new DB tables: `portfolio_program_allocations` (company↔program, allocated_headcount) + `program_project_allocations` (program↔project, allocated_headcount); (2) APIs: `GET/POST /api/portfolio/program-allocations`, `PUT/DELETE /[id]`, `GET/POST /api/programs/[id]/project-allocations`; (3) Portfolio Resources page: new "Phân bổ Program" tab — assign headcount quota per program with summary bar; (4) Programs page: Users icon on each card + `ResourceAllocDialog` to distribute program headcount across projects; `ProgramResourceBadge` shows portfolio/remaining inline; (5) Project Resources page: `headcount_quota` input replaced by read-only "Định biên từ Program" pulled from `program_project_allocations`. |
| 2026-05-28 | Budget Management Module: (1) Portfolio Budget (`/portfolio/budget`) — period-based budget (quarterly/monthly/yearly), category ceilings (CAPEX/OPEX/Vận hành), per-project allocations, warning badges when exceeded; APIs: `GET/POST /api/portfolio/budgets`, `GET/PUT/DELETE /api/portfolio/budgets/[id]`, categories + allocations sub-routes. (2) Operations (`/operations`, `/operations/[id]`) — manage post-project running systems with budget items, expense log, incidents (severity/status/cost_impact); APIs: `GET/POST /api/operations/systems` + sub-routes. (3) Project Budget enhanced: Estimate→Approved→Actual 3-column layout, `approved_amount`+`budget_status` columns in `budget_items`+`projects`, allocation warning bar from portfolio, "Submit for Approval" button. DB: 7 new tables + 3 ALTER TABLE migrations. Sidebar: added Portfolio Budget + Operations nav. |
| 2026-05-27 | Resource Management: (1) Portfolio Resources (`/portfolio/resources`) — Export .xlsx button (2-sheet: internal + external, quota summary row); Định biên khối quota bar (Định biên / Đã phân bổ / Còn lại / progress) persisted in `companies.headcount_quota`; new `GET/PUT /api/portfolio/quota`. (2) Project Resource Plan (`/projects/[id]/resources`) — Định biên KH quota bar (editable, saved via PATCH /api/projects/[id]) showing Thực tế / Độ phủ % / Còn thiếu; `projects.headcount_quota` column added via migration. |
| 2026-05-25 | Resource Management: (1) Global Resource View (`/resources`) — added "Tổng đến nay" column (sum of person-months allocated up to current month); click name or value opens `PersonDetailDialog` with per-project breakdown table + monthly capacity grid. (2) Portfolio Resources (`/portfolio/resources`) — split into 2 tabs: "Nhân sự trong khối" (internal) and "Nhân sự ngoài khối" (external/borrowed); `member_type` column added to `portfolio_members` table; existing AI Platform members auto-migrated to `member_type='external'`; each tab has own Add/Import actions. |
| 2026-05-25 | Portfolio Resource Management: new `portfolio_members` table (Role/Name/Email/Note), API `/api/portfolio/members` (GET/POST) + `/api/portfolio/members/[id]` (PUT/DELETE), page `/portfolio/resources` with inline edit + 3-step import wizard (`PortfolioImportDialog`); Project Resource Plan: Name field now has autocomplete from portfolio members (filter by name or email, auto-fills Role on select); Sidebar: added "Resource Management" link in portfolio NAV |
| 2026-05-24 | Resource plan: 3-step CSV/Excel import wizard (`components/resources/ResourceImportDialog.tsx`) — Upload→Map columns→Preview; Domain renamed to Squad/Team (free text Input, not dropdown); filter by Squad/Team; dynamic grouping from actual data |
| 2026-05-18 | Project Timeline Roadmap overhaul: collapsible epics (toggle + Collapse All), Year/Quarter/Month selector, bars clipped to range, alternating phase backgrounds + colored left border, redesigned left panel (compact status+dates line), Blocked/Deferred exempt from lag; Table: remove Deliverable column, wider Key column |
| 2026-05-18 | Jira CSV import + Key/Sprint fields: text-paste import mode, EPIC→Phase hierarchy, dynamic phases (not fixed list), jira_key+sprint DB columns, bulk upsert API, status value mapping UI, upsert preview with overwrite count |
| 2026-05-17 | Add Portfolio Roadmap page (`/portfolio/roadmap`): Gantt-style timeline X=quarters, Y=customer/phase rows, project bars with fill=completion%, RAG dot, sticky header+labels, today marker, collapsible groups |
| 2026-05-08 | Flexible timeline import: column mapping dialog, template save/load, date normalization, fuzzy enum matching |
| 2026-05-08 | Add `timeline_import_mappings` table; API routes `/api/parse-file-headers`, `/api/import-mapping` |
| 2026-05-08 | Auto-detect header row in Excel/CSV (skip leading empty rows) |
| 2026-05-08 | Import mapping UI redesigned as 2-panel layout (file columns ↔ timeline fields) |
| 2026-05-09 | Import mapping right panel: grouped fields (6 categories), per-group progress, sample preview with conversion highlight |
| 2026-05-08 | Initial CODEBASE.md snapshot created |
