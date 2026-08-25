# Phase 8: INTG-08 Credential Cutover - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 5 (2 route deletions, 1 script run, 2 planning artifacts)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/verify-credential-cutover.ts` | script (evidence gate) | batch / transform | Self (Phase 3 03-01) + `03-04-SUMMARY.md` invocation | exact |
| `app/api/jira/search/route.ts` | route | request-response | Live POST handler in same file (lines 28–84) + `app/api/jira/test/route.ts` resolver pattern | exact (post-deletion target) |
| `app/api/jira/fields/route.ts` | route | request-response | Live GET handler in same file (lines 8–27) | exact (post-deletion target) |
| `.planning/REQUIREMENTS.md` | config / planning doc | — | Other `[x] **INTG-*` rows in same file (e.g. INTG-07) | exact |
| `.planning/WINDOWS.md` | config / planning doc | — | Self (schema v1 ledger) + `gsd-tools windows fixed` | exact |

**Out of scope (do not modify unless grep finds leftovers):** `lib/integrations/credentials.ts`, `app/api/jira/test/route.ts`, Anthropic report routes.

---

## Pattern Assignments

### `scripts/verify-credential-cutover.ts` (script, batch/transform)

**Analog:** `scripts/verify-credential-cutover.ts` (Phase 3 03-01) + evidence invocation from `03-04-SUMMARY.md` / `08-RESEARCH.md`.

**Action:** RUN only — do not edit or delete. This file is the INTG-08 gate, not dead code.

**Windows invocation pattern** (from RESEARCH — verified on host):

```powershell
npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts
echo $LASTEXITCODE   # must be 0
```

**Core gate logic** (lines 49–99):

```typescript
async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('set DATABASE_URL and re-run');
    return 1;
  }

  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  let exitCode = 0;

  try {
    await getDb();
    const { rows } = await pool.query<JiraRow>(
      'SELECT company_id, base_url_var, email_var, token_var FROM company_jira_config',
    );

    for (const row of rows) {
      const oldJira = oldJiraPath(row);
      const newJira = await resolveJiraCredentials(row.company_id);
      // ... match comparison ...
      console.log(
        `${row.company_id} | old: ${oldJiraLabel} | new: ${newJiraLabel} | match: ${match ? 'yes' : 'no'}`,
      );
      if (!match) exitCode = 1;
    }

    const oldAnthropic = await oldAnthropicPath();
    const newAnthropic = (await resolveAnthropicCredentials())?.apiKey ?? null;
    // ...
  } finally {
    await pool.end();
  }

  return exitCode;
}
```

**Hard stops:** exit non-zero, any `match: no`, or `set DATABASE_URL and re-run` → halt deletion task. Paste stdout verbatim into plan SUMMARY / VERIFICATION (shape only — never copy DATABASE_URL or token values).

**Expected output shape** (zero `company_jira_config` rows is valid):

```text
anthropic | old: OK|UNSET | new: OK|UNSET | match: yes
```

---

### `app/api/jira/search/route.ts` (route, request-response)

**Analog (target state after deletion):** Live POST handler in same file (lines 28–84) — already wired to resolver; `app/api/jira/test/route.ts` (lines 55–58) for the shared resolver call idiom.

**DELETE:** lines 8–26 (INTG-08 comment + `getJiraCredentials`) and the now-unused `companyJiraConfig` import (line 3).

**Imports pattern — target after deletion** (mirror test route minus `companyJiraConfig`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { searchIssues } from '@/lib/integrations/jira/client';
```

**Auth pattern** (lines 28–37 — KEEP unchanged):

```typescript
export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 401 }
    );
  }
```

**Core resolver pattern** (lines 39–45 — KEEP unchanged):

```typescript
  const creds = await resolveJiraCredentials(user.company_id);
  if (!creds) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 503 }
    );
  }
```

**Error handling pattern** (lines 59–83 — KEEP unchanged):

```typescript
  try {
    const { issues, total, nextPageToken: token } = await searchIssues(creds, {
      jql, nextPageToken, maxResults, extraFields,
    });
    // ... debug log ...
    return NextResponse.json({ issues, total, nextPageToken: token });
  } catch (err) {
    return integrationErrorResponse(err);
  }
```

**HYG-01 commit message:**

```text
refactor(08): delete old inline credential paths after resolver cutover verified (INTG-08, HYG-01)
```

---

### `app/api/jira/fields/route.ts` (route, request-response)

**Analog (target state after deletion):** Live GET handler (lines 8–27) — this IS the post-deletion file; delete only the dead block below it.

**DELETE:** lines 29–43 (INTG-08 comment + `oldInlineCredentialBlock`).

**KEEP:** `companyJiraConfig` import and the two-503 split — Phase 3 behavior freeze.

**Imports pattern** (lines 1–6 — unchanged):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { listFields } from '@/lib/integrations/jira/client';
```

**Two-503 split pattern** (lines 12–19 — KEEP verbatim):

```typescript
  // Distinguish the two 503 cases the route emits today: no saved config vs
  // config saved but env values missing. The resolver collapses both to null,
  // so the config-row presence check lives here (no credential resolution).
  const cfg = await companyJiraConfig(user.company_id);
  if (!cfg?.base_url_var) return NextResponse.json({ error: 'Jira chưa cấu hình' }, { status: 503 });

  const creds = await resolveJiraCredentials(user.company_id);
  if (!creds) return NextResponse.json({ error: 'Thiếu env vars' }, { status: 503 });
```

**Error handling pattern** (lines 21–26 — KEEP unchanged):

```typescript
  try {
    const customFields = await listFields(creds);
    return NextResponse.json(customFields);
  } catch (err) {
    return integrationErrorResponse(err);
  }
```

**Post-deletion file ends at line 27** — no trailing dead code.

---

### `.planning/REQUIREMENTS.md` (config, planning closure)

**Analog:** Completed INTG rows in same file (e.g. INTG-07 line 35).

**When:** Check off INTG-08 only after both evidence run AND HYG-01 deletion commit exist.

**Checkbox pattern — before** (line 36):

```markdown
- [ ] **INTG-08**: The credential resolver preserves every currently-working tenant configuration — verified per configured company before the old paths are deleted <!-- Phase 8: run scripts/verify-credential-cutover.ts against a live DATABASE_URL, then HYG-01 deletion of dead Jira credential blocks. See 03-VERIFICATION.md. -->
```

**Checkbox pattern — after** (mirror INTG-07 style):

```markdown
- [x] **INTG-08**: The credential resolver preserves every currently-working tenant configuration — verified per configured company before the old paths are deleted <!-- Phase 8: verify-credential-cutover.ts exit 0 + HYG-01 deletion commit -->
```

**Traceability table row** (line 141 — update to Complete):

```markdown
| INTG-08 | Phase 3, Phase 8 | Complete |
```

**Footer count** (line 183):

```markdown
- Checked off: 54/54
```

**Reference:** Phase 5 `05-03-SUMMARY.md` folded REQUIREMENTS checkoff into the verification task after greps + full suite green — same sequencing here: evidence → deletion → greps → tsc → npm test → REQUIREMENTS.

---

### `.planning/WINDOWS.md` (config, ledger closure)

**Analog:** Self — schema v1 ledger with `gsd-tools windows fixed <id>`.

**Action:** Close entries 1, 2, 3 after HYG-01 commit lands.

| id | kind | file | close trigger |
|----|------|------|---------------|
| 1 | stub | `app/api/jira/search/route.ts` | `getJiraCredentials` deleted |
| 2 | stub | `app/api/jira/fields/route.ts` | `oldInlineCredentialBlock` deleted |
| 3 | unrun-verify | `scripts/verify-credential-cutover.ts` | script run exit 0 + deletion commit |

**Closure command** (from WINDOWS.md header, line 14):

```text
gsd-tools windows fixed <id>
```

Run for ids 1, 2, 3. Update frontmatter counts (`open_count: 0`, `fixed_count: 3`) and set table `status` → `fixed` with `resolved_at` timestamp. JSON block at bottom must stay in sync with the table.

**Blocking rule:** `/gsd-ship` blocks while `open_count > 0` — all three must close before ship.

---

## Shared Patterns

### Evidence-Gated Pure Deletion (HYG-01)

**Source:** `03-04-SUMMARY.md` deviation + `08-CONTEXT.md` Deletion Scope  
**Apply to:** Both Jira route deletions

Sequence:

1. Run cutover script → record stdout → exit 0 required.
2. Dedicated deletion commit — pure removal, no behavior change.
3. Boundary greps + `npx tsc --noEmit` + `npm test`.

**Phase 3 established:** dead blocks preserved as marked unreachable code so bisect lands on one commit. Phase 8 executes step 1 then step 2.

### Unified Credential Resolver

**Source:** `lib/integrations/credentials.ts:19-30`  
**Apply to:** All live Jira routes (unchanged by this phase)

```typescript
export async function resolveJiraCredentials(
  companyId: number | null,
  explicit?: { base_url_var: string; email_var: string; token_var: string },
): Promise<JiraCredentials | null> {
  const cfg = explicit ?? await companyJiraConfig(companyId);
  if (!cfg?.base_url_var || !cfg?.email_var || !cfg?.token_var) return null;
  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email = process.env[cfg.email_var];
  const token = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return null;
  return { baseUrl, email, token };
}
```

Post-deletion grep must show **3** production call sites:

```text
rg "resolveJiraCredentials\(" app/api/jira/
```

### Post-Deletion Verification

**Source:** `03-04-SUMMARY.md` Verification Evidence table + `08-RESEARCH.md` Validation Architecture

| Check | Command | Pass criterion |
|-------|---------|----------------|
| Dead names gone | `rg "getJiraCredentials\|oldInlineCredentialBlock" app/` | zero matches |
| Resolver wired | `rg "resolveJiraCredentials\(" app/api/jira/` | 3 matches (search, fields, test) |
| Anthropic inline fallbacks | `rg "getSetting\('anthropic_api_key'\)" app/api/` | zero (grep-only; delete only if found) |
| Type safety | `npx tsc --noEmit` | exit 0 |
| Regression | `npm test` | exit 0, 0 failed |
| Targeted Jira tests | `npx vitest run app/api/jira/test lib/integrations/credentials.unit.test.ts` | all pass |

**Test analog for resolver behavior:** `lib/integrations/credentials.unit.test.ts:21-60` (mocked `companyJiraConfig`, env stubbing). **Route regression analog:** `app/api/jira/test/route.test.ts:4-12` (mock auth, repo, client — no inline credential resolution in tests).

### Integration Error Handling (unchanged)

**Source:** `app/api/jira/search/route.ts:81-83`, `app/api/jira/fields/route.ts:24-26`  
**Apply to:** Both routes after deletion

```typescript
} catch (err) {
  return integrationErrorResponse(err);
}
```

Do not add route-level Jira error mapping — search/fields delegate to shared mapper (unlike test route's special upstream prefix handling).

---

## No Analog Found

None — every in-scope file has an exact or self-referential analog.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

**Conditional grep-only scope:** If `rg "getSetting\('anthropic_api_key'\)" app/api/` returns matches, treat those routes like the Jira dead-block deletion (HYG-01 same commit). Research verified zero matches this session — do not invent deletions.

---

## Metadata

**Analog search scope:** `app/api/jira/**`, `lib/integrations/credentials.ts`, `scripts/verify-credential-cutover.ts`, `.planning/REQUIREMENTS.md`, `.planning/WINDOWS.md`, Phase 3 summaries (`03-04-SUMMARY.md`, `03-VERIFICATION.md`)
**Files scanned:** 12
**Pattern extraction date:** 2026-08-25
