# Phase 3: Integration Clients - Research

**Researched:** 2026-08-10
**Domain:** External-service client boundary (Jira Cloud REST, Anthropic Messages API, Resend HTTP) under Next.js 16 route handlers
**Confidence:** HIGH (installed-package and repo evidence); MEDIUM for Vitest-4-change and zod-v3-survival claims (offline, marked below)

## Summary

Phase 3 extracts every outbound call into three dedicated client modules under `lib/integrations/{jira,anthropic,resend}/client.ts` plus one credential resolver (`lib/integrations/credentials.ts`) and one normalized error type (`lib/integrations/errors.ts`). Grep confirms today's exact surface: 5 routes construct `new Anthropic({apiKey})` directly (`app/api/projects/[id]/report/route.ts:222`, `app/api/projects/[id]/project-report/route.ts:377`, `app/api/projects/[id]/project-report/generate-email/route.ts:62`, `app/api/portfolio/report/route.ts:631`, `app/api/portfolio/report/generate-email/route.ts:57`), 3 Jira routes `fetch` Atlassian directly (`app/api/jira/search/route.ts:64`, `app/api/jira/fields/route.ts:19`, `app/api/jira/test/route.ts:67`), and 1 route calls Resend (`app/api/portfolio/report/send-email/route.ts:26`). `lib/` currently contains **zero** outbound calls, so the clients introduce the boundary cleanly. All 9 route files are in `app/`, which keeps Phase 2's "lib never imports `next/server`" invariant intact — error-to-HTTP mapping lives in `lib/api-errors.ts`, exactly as `repoErrorResponse` does today.

**Primary recommendation:** One `lib/integrations/` tree, named-function-export clients (mirroring Phase 2 repositories), an `AbortController`-based 15s timeout for Jira/Resend `fetch`, the Anthropic SDK's own `timeout` option at 120s (client-constructed once, injected — not per-request override), `zod` v4 added as a direct dependency, permissive only-what-is-consumed response schemas, and a read-only INTG-08 verification script that compares old-path and new-path resolution per configured company before either old inline block is deleted.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential resolution (env names + DB lookups) | API / Backend | Database / Storage | Reads `company_jira_config` and `settings` via repositories (`jira-config.repo`, `settings.repo`); must stay server-side, never reach the browser (secrets) |
| Jira Cloud REST calls | API / Backend | — | `fetch` over Node runtime; route handlers are the only current callers (`app/api/jira/*`) |
| Anthropic Messages calls | API / Backend | — | Node-runtime SDK; route handlers construct the client today |
| Resend email send | API / Backend | — | `fetch` POST to `api.resend.com`; single route |
| HTTP status mapping for integration errors | Route boundary (not tier) | — | `lib/api-errors.ts` owns `repoErrorResponse` today; `integrationErrorResponse` extends it — keeps `next/server` out of `lib/integrations/` (INTG-04, HYG-01) |
| Response validation | API / Backend | — | Zod schema at each client boundary before any caller consumes data (INTG-05, INTG-06) |
| Outbound request timeout | API / Backend | — | Jira/Resend: `AbortController`; Anthropic: SDK `timeout` option (SDK-internal `AbortController`, verified) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 4.x (4.3.6 already installed transitively; pin `^4.3.6` or `^4`) | Response/credential validation at client boundaries | INTG-05/06 require boundary validation; already in the tree as a shadcn peer so no new transitive footprint |
| `@anthropic-ai/sdk` | ^0.92.0 (installed) | Anthropic client | Already the app's AI SDK; client-level `timeout` exists (`client.d.ts:52`) and per-request `RequestOptions.timeout` exists (`internal/request-options.d.ts:47`) |
| `node:undici` global `fetch` (Node 20+) | Node 20 | Jira/Resend HTTP | Already used everywhere; add `AbortController` signal |
| `@/lib/api-errors` | — | `integrationErrorResponse(e)` | Extends the existing `repoErrorResponse` pattern (Phase 2), no new framework dep in the pure layer |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` `.passthrough()` / `.strict()` | 4.x | Permissive vs strict schemas | `.passthrough()` for Jira issue/field envelopes (upstream additions must not break); `.strict()` never for envelopes, only if a full-shape contract exists (none does here) |
| `zod/v3` entry | 4.x | Interop with shadcn's `zod-to-json-schema` peer | Only if a future route needs it; today's client-boundary validation does not |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod v4 | zod v3 (`3.25.76`) | v3 would fork the already-installed v4 (shadcn peer), adding a duplicate dep for no gain; v4 has no engines constraint and `safeParse` shape is verified identical to v3 |
| SDK `timeout` option | External `AbortController` around Anthropic calls | SDK already aborts internally and maps to `APIConnectionTimeoutError` (`client.js:275-277`); a caller-side abort would surface as `APIUserAbortError` and is redundant |
| One shared 15s timeout | Per-service timeouts | Anthropic report generation is legitimately long — a shared short timeout breaks working features (CONTEXT trap) |
| Model IDs inline | `models.ts` constants | Behavior freeze; CONTEXT mandates named constants with same values |

**Installation:**
```bash
npm install zod@^4.3.6
```

**Version verification (registry, 2026-08-10):**
- `zod` latest = 4.4.3; zod@4 latest 4.4.3; zod@3 latest 3.25.76. Lock already pins `node_modules/zod@4.3.6` at root as a transitive peer; `npm view zod version` → `4.4.3`.
- `zod` has **no `engines` field** in any 4.x (verified on installed 4.3.6 and registry), so Node 20 and 25 both install cleanly. Zero runtime dependencies.
- Package legitimacy gate: `zod` → verdict **OK** (exists, `publishedAt 2026-05-04`, 253.9M weekly downloads, source repo `github.com/colinhacks/zod`, `deprecated: false`, **no postinstall script**).
- `@anthropic-ai/sdk` installed = 0.92.0; `vitest` installed = 4.1.10.

## Package Legitimacy Audit

> Run per protocol. `zod` is the only package this phase adds; `@anthropic-ai/sdk` and `vitest` are already pinned in `package.json`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `zod` | npm | ~5 yrs (4.3.6 published 2026-05-04) | 253.9M/wk | github.com/colinhacks/zod | [OK] | Approved — `npm install zod@^4.3.6` |
| `@anthropic-ai/sdk` | npm | existing dep | — | github.com/anthropics/anthropic-sdk-typescript | [OK] | Already installed, unchanged |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*`zod`'s version line in this research (`4.x`) is tagged [VERIFIED: npm registry] — confirmed by `npm view` AND the already-installed 4.3.6 at `node_modules/zod/`. The v3-vs-v4 *survival* assessment (zod-to-json-schema interop) is [ASSUMED] — see Assumptions Log A3.*

## Architecture Patterns

### System Architecture Diagram

```
Browser/UI (client components)
   │  fetch('/api/jira/search' | '/api/portfolio/report' ...)  + pm_session cookie
   ▼
Route Handlers (app/api/**/route.ts)   ← auth gate (getSessionFromRequest), unchanged (Phase 5/6)
   │  resolve credentials via lib/integrations/credentials.ts
   │  call client functions: searchIssues() / listFields() / testConnection() / createMessage() / sendEmail()
   ▼
lib/integrations/{jira,anthropic,resend}/client.ts
   │  permissive zod schema at boundary (INTG-05/06)
   │  normalized IntegrationError{kind: timeout|auth|upstream|validation|network} (INTG-04)
   ▼
External services:
   Jira Cloud REST (POST /rest/api/3/search/jql, GET /rest/api/3/field, GET /rest/api/3/myself)  — AbortController 15s
   Anthropic Messages API (messages.create)  — SDK timeout 120s
   Resend (POST https://api.resend.com/emails)  — AbortController 15s
   ▲
   errors flow back → route maps via lib/api-errors.ts integrationErrorResponse(e) → HTTP JSON
```

Data flow for the primary use case (Jira search): route → session gate → `resolveCredentials('jira', companyId)` → `searchIssues(creds, {jql,...})` → build Basic auth + POST with 15s `AbortController` signal → if `!resp.ok` parse upstream JSON error message (preserve Vietnamese strings) → else zod-parse `{issues, total, nextPageToken}` permissively → shape mismatch ⇒ log + `IntegrationError{kind:'validation'}` ⇒ route returns 502. Timeout ⇒ `IntegrationError{kind:'timeout'}`. Same spine for Anthropic (`createMessage`) and Resend (`sendEmail`).

### Recommended Project Structure
```
lib/integrations/
├── errors.ts          # IntegrationError class + kinds; no next/server import
├── credentials.ts     # resolveCredentials(kind, companyId) → typed creds | null
├── jira/
│   ├── client.ts      # searchIssues(), listFields(), testConnection() — 15s AbortController, zod schemas
│   ├── schemas.ts     # jiraSearchResponseSchema, jiraFieldSchema, jiraMeSchema (permissive, only-what-is-consumed)
│   └── client.unit.test.ts
├── anthropic/
│   ├── client.ts      # createMessage({...}) — SDK client injected, timeout 120s, output validation
│   ├── models.ts      # MODEL_OPUS_4_7='claude-opus-4-7', MODEL_SONNET_4_6='claude-sonnet-4-6'
│   ├── schemas.ts     # anthropicTextBlockSchema / messageResponseSchema
│   └── client.unit.test.ts
└── resend/
    ├── client.ts      # sendEmail({...}) — 15s AbortController
    ├── schemas.ts     # resendResponseSchema (id only)
    └── client.unit.test.ts
```
Schemas may live inline in `client.ts` (CONTEXT discretion) — the separate `schemas.ts` is suggested, not mandated.

### Pattern 1: Named-function clients (mirror Phase 2 repositories)
**What:** Module exports plain async functions, takes already-resolved credentials as arguments, returns plain data. Never imports a repository, a session, or `next/server` (INTG-09, mirroring REPO-06).
**When to use:** Every integration client.
**Example (Jira search, shapes derived from `app/api/jira/search/route.ts:36-104`):**
```ts
// lib/integrations/jira/client.ts
import { jiraSearchResponseSchema } from './schemas';
import { IntegrationError, withFetchTimeout } from '@/lib/integrations/errors';
import type { JiraCredentials } from '@/lib/integrations/credentials';

export type SearchIssuesParams = {
  jql: string;
  nextPageToken?: string;
  maxResults?: number;
  extraFields?: string[];
  signal?: AbortSignal; // optional caller abort, distinct from timeout
};

export async function searchIssues(creds: JiraCredentials, params: SearchIssuesParams) {
  const allFields = [...new Set([...DEFAULT_FIELDS, ...(params.extraFields ?? [])])];
  const body: Record<string, unknown> = { jql: params.jql, maxResults: params.maxResults ?? 100, fields: allFields };
  if (params.nextPageToken) body.nextPageToken = params.nextPageToken;

  const { response, error } = await withFetchTimeout(fetch(
    `${creds.baseUrl}/rest/api/3/search/jql`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds.email, creds.token),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
  ), 15_000);

  if (error) throw error;                                   // IntegrationError{kind:'timeout'|'network'}
  if (!response.ok) throw await upstreamError('jira', response); // IntegrationError{kind:'upstream'}

  const parsed = jiraSearchResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new IntegrationError({
    kind: 'validation', service: 'jira', cause: parsed.error,
  });
  return parsed.data; // { issues, total, nextPageToken } — defaulted, never partial-silent
}
```

### Pattern 2: Credential resolver (one module, per-integration precedence preserved)
**What:** `resolveCredentials(kind, companyId)` returns typed credentials or `null`. Precedence per integration is byte-for-byte preserved (INTG-08). Never a class.
**When to use:** The single entry point every route uses. The route passes `companyId` (and for the admin Jira-test path, an optional explicit config) and receives values.
**Example (Jira branch, matching `app/api/jira/search/route.ts:5-18` and `app/api/jira/test/route.ts:27-29`):**
```ts
// lib/integrations/credentials.ts
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';
import { getSetting } from '@/lib/repositories/settings.repo';

export type CredentialKind = 'jira' | 'anthropic' | 'resend';
export type JiraCredentials = { baseUrl: string; email: string; token: string };
export type AnthropicCredentials = { apiKey: string };
export type ResendCredentials = { apiKey: string };

// Jira: DB stores env var NAMES; values live in process.env. Precedence = the DB row,
// then the env value; null when any piece is missing (search/fields routes) OR the
// explicit admin-provided config for /api/jira/test.
export async function resolveJiraCredentials(
  companyId: number | null,
  explicit?: { base_url_var: string; email_var: string; token_var: string },
): Promise<JiraCredentials | null> {
  const cfg = explicit ?? await companyJiraConfig(companyId);
  if (!cfg?.base_url_var || !cfg?.email_var || !cfg?.token_var) return null;
  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email   = process.env[cfg.email_var];
  const token   = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return null;
  return { baseUrl, email, token };
}

// Anthropic: process.env first, then DB settings. The two current code variants
// (route.ts vs generate-email) differ ONLY when ANTHROPIC_API_KEY=''; the resolver
// adopts `env || db` (CONTEXT: empty-string env treated as unset) — the only intentional
// normalization.
export async function resolveAnthropicCredentials(): Promise<AnthropicCredentials | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY || await getSetting('anthropic_api_key');
  if (!apiKey) return null;
  return { apiKey };
}

export async function resolveResendCredentials(): Promise<ResendCredentials | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}
```
> The Jira credential row type is `JiraConfigRow = { base_url_var; email_var; token_var }` — [VERIFIED: `lib/repositories/jira-config.repo.ts:3-7`]. The admin-test path accepts raw var names from the body (`app/api/jira/test/route.ts:27-29`); the resolver must accept that explicit config rather than assume the DB is the only source.

### Pattern 3: Timeout helper (AbortController + timer cleared on success)
**What:** A small `withFetchTimeout` wrapper in `lib/integrations/errors.ts` that runs `fetch` with a `signal` wired to a timer, clears the timer in `finally`, and maps the two abort causes separately. See **Code Examples** for the full copy-pasteable implementation. Key points from `node:undici` semantics (verified against the Anthropic SDK's own `isAbortError` at `internal/errors.js:6-12`): a timeout abort produces `DOMException` `name === 'AbortError'` from `fetch`, and a caller abort produces the same class, so distinguishing them requires a flag (the wrapper below passes an explicit `{ timedOut }` marker instead of inspecting the error).

### Pattern 4: Anthropic client with SDK timeout + output validation
**What:** Construct the `Anthropic` client once per call with `{ apiKey, timeout: 120_000, maxRetries: 0 }` — the SDK owns abort and maps to `APIConnectionTimeoutError` (`client.js:336-367` sets `setTimeout(abort, ms)` and `client.js:275-277` throws `APIConnectionTimeoutError` on abort). Validate `message.content` for a text block before returning (INTG-06).
**When to use:** Every `messages.create`. Response type `Message.content: Array<ContentBlock>`; `ContentBlock = TextBlock | ThinkingBlock | ...` — the **first** block is not guaranteed `type:'text'` (extended thinking prepends a `ThinkingBlock`), so validate by scanning `content` for a `type === 'text'` block rather than assuming `content[0]`.
**Example (models, behavior freeze):**
```ts
// lib/integrations/anthropic/models.ts
export const MODEL_OPUS_4_7 = 'claude-opus-4-7';
export const MODEL_SONNET_4_6 = 'claude-sonnet-4-6';
```
```ts
// lib/integrations/anthropic/client.ts
import Anthropic from '@anthropic-ai/sdk';
import { messageResponseSchema } from './schemas';
import { IntegrationError } from '@/lib/integrations/errors';

export type CreateMessageParams = {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export async function createMessage(creds: { apiKey: string }, params: CreateMessageParams) {
  const client = new Anthropic({ apiKey: creds.apiKey, timeout: 120_000, maxRetries: 0 });
  let message;
  try {
    message = await client.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      system: params.system,
      messages: params.messages as never,
    });
  } catch (e) {
    throw mapAnthropicError(e); // APIConnectionTimeoutError → timeout; AuthenticationError → auth; APIError → upstream; else network
  }
  const parsed = messageResponseSchema.safeParse(message.content);
  if (!parsed.success) throw new IntegrationError({ kind: 'validation', service: 'anthropic', cause: parsed.error });
  return parsed.data; // { text: string } — validated text content only
}
```
> `mapAnthropicError` must be imported from the SDK's **public** exports. The SDK re-exports `Errors` from the root package index: `index.js` re-exports `* as Errors` from `./core/error.js` (checked via `client.js:545-546` `BaseAnthropic.APIConnectionTimeoutError = Errors.APIConnectionTimeoutError`). So `import Anthropic, { APIConnectionTimeoutError, AuthenticationError, APIError } from '@anthropic-ai/sdk'` compiles in 0.92.0.

### Anti-Patterns to Avoid
- **`await req.json()` unguarded**: the Jira `test` route already tolerates an empty body (`app/api/jira/test/route.ts:23` `catch { /* empty body is fine */ }`); a naive `req.json()` rethrow breaks the admin test dialog's GET/POST dual path.
- **`console.error` raw SDK errors at the boundary**: leaks nothing today, but a validation failure must log and throw `IntegrationError{kind:'validation'}` → 502, never return a silent partial value (INTG-05/06, CONTEXT).
- **`.strict()` on upstream envelopes**: turns a harmless Jira/Anthropic field addition into a 502. Only validate what callers consume; leave the rest passthrough.
- **`maxRetries` default 2 on Anthropic**: the SDK retries transient 5xx/429 (default) and each retry re-arms the timeout — a 120s timeout can actually wait much longer. Decide explicitly: `maxRetries: 0` is the behavior-freeze-correct choice (today's raw `messages.create` has no retry/timeout at all).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Response validation | Hand-parsed guards / `typeof` chains | `zod` `safeParse` | INTG-05/06 require boundary validation; hand-rolled checks are exactly the silent-wrong-value trap the phase exists to kill |
| Request timeout for `fetch` | A re-implemented per-request timer without signal plumbing | `AbortController` + `signal` (thin 20-line wrapper, below) | Undici already propagates abort through `fetch`; the wrapper only distinguishes timeout-vs-caller-abort |
| HTTP error mapping | `next/server` imports inside `lib/integrations/` | `lib/api-errors.ts` `integrationErrorResponse(e)` | Mirrors Phase 2's `repoErrorResponse`; keeps the pure layer framework-free (REPO-06/INTG-04/HYG-01) |
| Anthropic timeout | Wrapping SDK in an external timer | SDK `timeout` client option | SDK already aborts internally and maps to `APIConnectionTimeoutError` — external timer duplicates it |

**Key insight:** every external caller today is a raw fetch/`new Anthropic` with no timeout and no shape check. The clients are thin — fetch/parse/validate/throw-normalized. The bulk of the risk is behavior preservation (status codes, Vietnamese strings, precedence), not novel logic.

## Runtime State Inventory

> Omitted — this is not a rename/refactor/migration of named entities; it is a behavioral extraction with no stored-data key changes. Credential *values* live in `process.env` (not git) and only the env var *names* live in the `company_jira_config` DB rows — no column or key rename occurs. The INTG-08 cutover check is described under Common Pitfalls / Verification, not here.

## Common Pitfalls

### Pitfall 1: Anthropic long generation vs short timeout
**What goes wrong:** A shared 15s (or shorter) timeout aborts legitimate report generation.
**Why it happens:** Anthropic calls are `claude-opus-4-7`/`claude-sonnet-4-6` with `max_tokens` 1024–3500; CONTEXT explicitly flags this trap.
**How to avoid:** Anthropic timeout 120s, at client construction. Do NOT use the `RequestOptions` per-request override — keep the timeout in one place (`new Anthropic({timeout})`).
**Warning signs:** `IntegrationError{kind:'timeout'}` on slow-but-fine prompts; user-visible "Lỗi kết nối Jira" (wrong) or a 502 on AI report routes.

### Pitfall 2: Empty-string env var handling
**What goes wrong:** The two current Anthropic resolution variants disagree when `ANTHROPIC_API_KEY=''` — `app/api/projects/[id]/report/route.ts:148` uses `process.env.ANTHROPIC_API_KEY || (await getSetting(...))` (falls back to DB), but `app/api/portfolio/report/generate-email/route.ts:37-41` uses `if (!apiKey) { apiKey = await getSetting(...) }` (also falls back). They are equivalent *except* that an env var set to an **empty string** is truthy in the first and falsy-checked in the second — the second's `if (!apiKey)` treats `''` as unset, the first's `||` also treats it as unset. The resolver must adopt `env || db` and treat empty-string as unset consistently (CONTEXT: only intentional normalization).
**How to avoid:** Use `process.env.ANTHROPIC_API_KEY || await getSetting('anthropic_api_key')` in the resolver and unit-test the `''` case.
**Warning signs:** A tenant that set `ANTHROPIC_API_KEY=''` in Railway env behaves differently before/after cutover.

### Pitfall 3: Admin Jira-test path passes env var names in the request body
**What goes wrong:** `app/api/jira/test/route.ts:27-29` lets an admin test **un-saved** var names. If the resolver only reads `companyJiraConfig`, the admin test dialog's "Kiểm tra kết nối" before saving breaks.
**Why it happens:** The body carries `{ companyId, base_url_var, email_var, token_var }` (`app/admin/page.tsx:136`).
**How to avoid:** `resolveJiraCredentials(companyId, explicit?)` — the route passes the parsed body config when present; otherwise DB config. Preserve the missing-env diagnostic shape from `app/api/jira/test/route.ts:51-62` (`Biến môi trường chưa được set trên Railway: ${missing.join(', ')}` plus the `missing` array).
**Warning signs:** Admin config dialog shows a failure before save when the env vars are set.

### Pitfall 4: Preserving Vietnamese error strings and status codes
**What goes wrong:** Behavior freeze means users must see identical strings/codes. Today: `Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.` (503, `search`), `Jira chưa cấu hình` (503, `fields`), `Thiếu env vars` (503, `fields`), `Lỗi kết nối Jira: ${msg}` (500, `search`), `Biến môi trường chưa được set trên Railway: ${missing}` (503 + `missing` array, `test`), `Jira trả về lỗi ${resp.status}` / `Jira error ${resp.status}` (pass-through), `NO_API_KEY` (503, Anthropic routes), `NO_RESEND_KEY` (503, Resend), `MISSING_FIELDS` (400, Resend), Resend upstream `{error: data.message ?? data.name ?? 'Resend API error'}` (502). Additionally the search route's custom-fields debug log (`console.log('[jira/search] custom fields on first issue:', ...)`, `route.ts:87-94`) is a *behavior* some operators may depend on.
**How to avoid:** The route mapper `integrationErrorResponse(e)` must reproduce these exact strings per service/kind, and the plan's verification compares response bodies before/after (e.g., a route-level test asserting the JSON). Preserve the `search` route's error-parsing (Jira `errorMessages.join('; ')` fallback to `message`, `route.ts:74-83`).
**Warning signs:** `git diff` of the route files shows changed user-facing strings; a route unit test asserting `{error: '...'}` would fail.

### Pitfall 5: `INSERT`-style behavior-freeze risk of changing status codes
**What goes wrong:** CONTEXT pins 503 (missing creds) / pass-through (Jira upstream) / 502 (Resend upstream) / 500/502 (Anthropic). A naive unified mapper could collapse these into one code and break contract.
**Why it happens:** Anthropic routes split between 500 (`report`, `project-report`) and 502 (`generate-email` variants) today — a single `kind→status` map cannot reproduce both.
**How to avoid:** Map per (service, kind) explicitly: `jira`+`upstream` → pass-through status from `IntegrationError.status`; `resend`+`upstream` → 502; `anthropic`+`upstream` → 502; `anthropic`+`network`/`timeout`/`validation` → 502 (matches the email routes) — and keep the two 500 report routes' current behavior by documenting the split, or decide to converge them to 502 as a called-out behavior change (HYG-02) and get user confirmation. Recommend: converge to 502 for all Anthropic failures and call it out as an opportunistic fix, since 500 vs 502 was arbitrary in the source.
**Warning signs:** `search` route returns a non-pass-through code for an upstream 401/429; `fields` route loses the `Thiếu env vars` 503.

### Pitfall 6: Timeout/caller-abort conflation
**What goes wrong:** `AbortController.abort()` on the *caller* signal and the internal timeout both surface as the same `AbortError`. If the client maps every abort to `timeout`, a route cancellation becomes a false 502; if it maps every abort to `network`, timeouts become generic messages.
**How to avoid:** The wrapper distinguishes them with an explicit flag (see Code Examples) and the route maps `kind:'timeout'` distinctly.
**Warning signs:** Unit test that aborts the caller signal and asserts `kind:'timeout'` (should be `kind:'network'` or a pass-through) — or vice versa.

### Pitfall 7: Over-strict or under-consumed zod schemas
**What goes wrong:** A `.strict()` issue schema 502s on an upstream customfield addition; conversely a schema that *requires* `content[0].type === 'text'` breaks when extended thinking inserts a `ThinkingBlock` first.
**How to avoid:** `.passthrough()` envelopes, `.optional()` on nullable fields (`assignee`, `priority`, `duedate` are null in Jira), and scan `content` for a text block instead of indexing 0.
**Warning signs:** `IntegrationError{kind:'validation'}` in logs on a real upstream change; flaky AI reports after Anthropic adds a block type.

### Pitfall 8: New tables / schema drift (integration clients are not repositories)
**What goes wrong:** `lib/integrations/` must not sneak DB DDL or migrate loops in. `company_jira_config` shape is fixed (`lib/db.ts:89-94`).
**How to avoid:** The clients import only `@/lib/integrations/*` and the repos via the credentials module; no new SQL, no `lib/db.ts` changes.

## Code Examples

### Common Operation 1 — fetch timeout wrapper (Jira/Resend)
Copy-pasteable into `lib/integrations/errors.ts`:
```ts
// lib/integrations/errors.ts
export type IntegrationErrorKind = 'timeout' | 'auth' | 'upstream' | 'validation' | 'network';

export class IntegrationError extends Error {
  readonly kind: IntegrationErrorKind;
  readonly service: string;
  readonly status?: number;   // upstream HTTP status when kind==='upstream'/'auth'
  readonly cause?: unknown;
  constructor(opts: { kind: IntegrationErrorKind; service: string; status?: number; cause?: unknown; message?: string }) {
    super(opts.message ?? `IntegrationError[${opts.service}:${opts.kind}]`);
    this.name = 'IntegrationError';
    this.kind = opts.kind;
    this.service = opts.service;
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

// Distinguish a timeout from a caller abort: abort() before fetch rejects the same
// DOMException('AbortError'), so we record which one fired instead of inspecting errors.
export async function withFetchTimeout<T>(
  promise: Promise<T>,
  ms: number,
  callerSignal?: AbortSignal,
): Promise<{ value: T; error: null } | { value: null; error: IntegrationError }> {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  if (callerSignal?.aborted) controller.abort();
  else if (callerSignal) callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  try {
    const value = await promise; // fetch already wired to controller.signal by the caller
    return { value, error: null };
  } catch (e) {
    if (timedOut) return { value: null, error: new IntegrationError({ kind: 'timeout', service: 'jira', cause: e }) };
    if (callerSignal?.aborted) return { value: null, error: new IntegrationError({ kind: 'network', service: 'jira', cause: e }) };
    return { value: null, error: new IntegrationError({ kind: 'network', service: 'jira', cause: e }) };
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}
```
> The wrapper receives a `fetch` whose `signal` is `controller.signal` (the caller creates the controller *inside* the helper so it can own both the timer and the signal — the snippet above shows the ownership shape; the caller passes the controller's `signal` into `fetch` and the helper's caller-signal parameter is the route's optional cancellation signal). Timer is cleared in `finally` on success so the process never hangs (INTG-04 + "clears the timer on success"). `fetch` rejections from a caller abort are indistinguishable from a network failure without the `callerSignal?.aborted` check — both map to `network`.

### Common Operation 2 — Zod Jira response schema (only-what-is-consumed)
Fields actually read (from `app/api/jira/search/route.ts` + `components/jira/JiraSyncDialog.tsx:28-47,175-234`):
```ts
// lib/integrations/jira/schemas.ts
import { z } from 'zod';

const jiraUser = z.object({ displayName: z.string() }).nullable();
const jiraOption = z.object({ name: z.string() }).nullable();

// Fields consumed per issue: key, id, fields.summary, fields.issuetype.name,
// fields.status.name, fields.assignee.displayName, fields.reporter.displayName,
// fields.priority.name, fields.labels[], fields.components[].name, fields.parent.key,
// fields.customfield_10014, _10015, _10016, _10020, fields.resolution.name,
// fields.created, fields.duedate — plus arbitrary virtual columns read in the dialog
// default branch via `f[colId]` (extractOptionValue), so the schema must passthrough fields.
const jiraIssueSchema = z.object({
  key: z.string(),
  id: z.union([z.string(), z.number()]),
  fields: z.object({
    summary: z.string(),
    issuetype: z.object({ name: z.string() }),
    status: z.object({ name: z.string() }),
    assignee: jiraUser,
    reporter: jiraUser,
    priority: jiraOption,
    labels: z.array(z.string()),
    components: z.array(z.object({ name: z.string() })),
    parent: z.object({ key: z.string() }).optional(),
    customfield_10014: z.string().optional(),          // Epic Link
    customfield_10015: z.string().nullable().optional(), // Start date
    customfield_10016: z.number().optional(),          // Story Points
    customfield_10020: z.array(z.object({ name: z.string(), state: z.string() })).or(z.string()).optional(), // Sprint
    resolution: z.object({ name: z.string() }).nullable().optional(),
    created: z.string(),
    duedate: z.string().nullable().optional(),
  }).passthrough(),
}).passthrough();

// POST /rest/api/3/search/jql envelope. 'issues' and 'total' and 'nextPageToken' are
// what the route consumes; everything else passthrough.
export const jiraSearchResponseSchema = z.object({
  issues: z.array(jiraIssueSchema).default([]),
  total: z.number().optional(),
  nextPageToken: z.string().nullable().optional(),
}).passthrough();

// GET /rest/api/3/field — fields consumed: id, name, custom, schema.type
export const jiraFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  custom: z.boolean(),
  schema: z.object({ type: z.string() }).optional(),
}).passthrough();

// GET /rest/api/3/myself — consumed: displayName, emailAddress, accountId
export const jiraMeSchema = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
  accountId: z.string(),
}).passthrough();
```
> Every field above was read from the verbatim call sites this session. `.passthrough()` on both issue and envelope means an upstream-added field never 502s.

### Common Operation 3 — Zod Anthropic text-block output validation
```ts
// lib/integrations/anthropic/schemas.ts
import { z } from 'zod';

// Message.content is Array<ContentBlock> = TextBlock | ThinkingBlock | ... (verified in
// messages.d.ts:435, 875). Only the text block is consumed. Scan for the FIRST text
// block; extended thinking can prepend a ThinkingBlock, so don't assume content[0].
export const messageContentSchema = z.array(z.object({
  type: z.literal('text'),
  text: z.string(),
}).passthrough()).nonempty();
```
> In the client, extract: `const textBlock = message.content.find(b => b.type === 'text')`; if none, throw `IntegrationError{kind:'validation'}`. The `.find` + zod-scan is belt-and-braces: zod asserts an array of text blocks, `.find` handles the heterogeneous `ContentBlock[]` union safely. `Message` shape verified: `content: Array<ContentBlock>` (`messages.d.ts:587`), `role:'assistant'` (`:599`), `TextBlock` = `{ citations: Array<TextCitation>|null; text: string; type:'text' }` (`:875-883`) — `citations` is REQUIRED in the SDK type, so zod's `type`/`text` subset with `.passthrough()` avoids needing to model `citations`.

### Common Operation 4 — Jira field-list extraction (fields route)
```ts
// lib/integrations/jira/client.ts
export async function listFields(creds: JiraCredentials): Promise<Array<{ id: string; name: string; type: string }>> {
  const { response, error } = await withFetchTimeout(fetch(`${creds.baseUrl}/rest/api/3/field`, {
    headers: { Authorization: basicAuth(creds.email, creds.token), Accept: 'application/json' },
  }), 15_000);
  if (error) throw error;
  if (!response.ok) throw await upstreamError('jira', response);
  const parsed = z.array(jiraFieldSchema).safeParse(await response.json());
  if (!parsed.success) throw new IntegrationError({ kind: 'validation', service: 'jira', cause: parsed.error });
  return parsed.data
    .filter(f => f.custom)
    .map(f => ({ id: f.id, name: f.name, type: f.schema?.type ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name)); // matches fields route sorting
}
```

### Common Operation 5 — Resend client
```ts
// lib/integrations/resend/client.ts
export type SendEmailParams = { from: string; to: string[]; subject: string; html: string; text?: string };
export async function sendEmail(creds: ResendCredentials, params: SendEmailParams) {
  const { response, error } = await withFetchTimeout(fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: params.from, to: params.to, subject: params.subject, html: params.html, text: params.text ?? '' }),
  }), 15_000);
  if (error) throw error;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // preserve 502 mapping: {error: data.message ?? data.name ?? 'Resend API error'}
    throw new IntegrationError({ kind: 'upstream', service: 'resend', status: response.status, cause: data });
  }
  const parsed = z.object({ id: z.string().optional() }).passthrough().safeParse(data);
  if (!parsed.success) throw new IntegrationError({ kind: 'validation', service: 'resend', cause: parsed.error });
  return parsed.data.id; // route returns { ok: true, messageId }
}
```
> Note the current Resend code calls `res.json()` **before** checking `res.ok` (`send-email/route.ts:35`), which is only safe because Resend returns JSON on error. Preserve that ordering to keep `data.message`/`data.name` extraction identical.

### Common Operation 6 — Vitest 4 unit tests (mock fetch, mock SDK, malformed-response case)
Installed version 4.1.10; `vi.stubGlobal`/`vi.unstubAllGlobals` verified present in `vitest/dist/index.d.ts:588,597`. Use `vi.hoisted` for the shared mock (same pattern as `lib/repositories/jira-config.repo.unit.test.ts:3-7`):
```ts
// lib/integrations/resend/client.unit.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

import { sendEmail } from './client';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('resend client', () => {
  it('sends an email and returns the message id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'msg_123' }));
    await expect(sendEmail({ apiKey: 'rk_live_x' }, {
      from: 'PMO Reports <onboarding@resend.dev>', to: ['a@b.com'], subject: 'S', html: '<b>hi</b>',
    })).resolves.toBe('msg_123');
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer rk_live_x' }),
    }));
  });

  it('throws IntegrationError{kind:"upstream"} with the upstream status on 4xx', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'missing from' }));
    await expect(sendEmail({ apiKey: 'rk' }, {
      from: 'x', to: ['a@b.com'], subject: 'S', html: 'h',
    })).rejects.toMatchObject({ kind: 'upstream', service: 'resend', status: 400 });
  });

  it('throws IntegrationError{kind:"validation"} on a malformed response (INTG-10)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: true }));
    await expect(sendEmail({ apiKey: 'rk' }, {
      from: 'x', to: ['a@b.com'], subject: 'S', html: 'h',
    })).rejects.toMatchObject({ kind: 'validation', service: 'resend' });
  });
});
```
For Jira, same shape with `vi.stubGlobal('fetch', ...)` and a `timeout` case driven by a mock that rejects with `new DOMException('...', 'AbortError')` after the caller signal aborts (assert `kind: 'network'`), and a malformed `{ issues: 'nope' }` case (assert `kind:'validation'`). For Anthropic, mock the module (no network, no DB):
```ts
// lib/integrations/anthropic/client.unit.test.ts
const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));
vi.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class { constructor() {} messages = { create: createMock } },
  APIConnectionTimeoutError: class APIConnectionTimeoutError extends Error {},
  AuthenticationError: class AuthenticationError extends Error {},
  APIError: class APIError extends Error {},
}));

import { createMessage } from './client';

it('throws kind:"validation" when the model returns a non-text block (INTG-06/10)', async () => {
  createMock.mockResolvedValue({ content: [{ type: 'thinking', thinking: '…' }] }); // no text block
  await expect(createMessage({ apiKey: 'k' }, { model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }))
    .rejects.toMatchObject({ kind: 'validation', service: 'anthropic' });
});
```
> The mocked default export is a class whose `messages.create` is the mock — matches `new Anthropic({...}).messages.create(...)` call shape used in all 5 routes. `vi.mock` is hoisted to the top of the file, so the `vi.hoisted` factory (same pattern as the existing `jira-config.repo.unit.test.ts`) is required to share the mock.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No timeouts anywhere; raw `fetch`/`new Anthropic` per route, errors bubble as `String(e)` → 500 | Dedicated client per service with explicit timeout + normalized `IntegrationError` | This phase (INTG-04) | Timeout and error shape become contract; routes keep user-visible strings |
| Anthropic error → `{error: e.message ?? 'AI generation failed'}` 500/502 | Mapped to `kind`-specific codes with preserved strings | This phase | No silent `String(e)` leak across the boundary |
| Two divergent credential patterns (Jira env-names-in-DB vs Anthropic env-then-DB) | One `resolveCredentials` preserving per-integration precedence | This phase (INTG-07/08) | One code path to test; behavior frozen until cutover verified |
| Unvalidated upstream JSON consumed directly | zod boundary validation | This phase (INTG-05/06) | Shape mismatch = logged validation error → 502, never silent wrong value |
| `@anthropic-ai/sdk` default `maxRetries: 2` | Explicit `maxRetries: 0` at client construction | This phase (opportunistic, HYG-02) | Removes hidden multi-attempt timeouts; call out in commit |

**Deprecated/outdated:**
- Raw `fetch` to `*.atlassian.net` from routes: replaced by `lib/integrations/jira/client.ts`.
- `new Anthropic({apiKey})` in routes: replaced by `lib/integrations/anthropic/client.ts`; keep `app/api/config/route.ts` masking (`***` / `anthropic_api_key_set`) untouched after the resolver lands (CONTEXT Integration Points).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vitest 4.1.10 has no breaking change to `vi.mock`/`vi.hoisted`/`vi.stubGlobal` that invalidates the existing repo unit-test pattern | Code Examples | Low — the pattern is already committed and passing in `lib/repositories/*.unit.test.ts`; the stubGlobal API is verified in the installed `.d.ts`; only "no v4-specific migration" is unverified offline |
| A2 | zod v3 (3.25.x) survival in the tree as a shadcn peer remains satisfied by a v4 root install | Standard Stack | Low — the lock already resolves `zod-to-json-schema` against root `zod@4.3.6` (`package-lock.json:13489-13495` peer `^3.25.28 \|\| ^4`), so no v3 fork occurs today |
| A3 | The `search` route's debug custom-fields log is a behavior operators may rely on | Common Pitfalls 4 | Medium — it is a `console.log`; if anything parses stdout it would break if removed. Recommendation: keep it behind the same client path or drop deliberately as a called-out cleanup (HYG-02) |
| A4 | Converging Anthropic 500-report routes to 502 is an acceptable opportunistic fix | Pitfall 5 | Medium — CONTEXT pins "500/502 as currently used"; the split is preserved or the convergence is called out in the commit (HYG-02). Requires user confirmation if converging |
| A5 | Node 25 local dev tolerates zod v4 (no engines field anywhere) | Standard Stack | Low — zod declares no engines; `next build`/`tsc` run on Node 25 here and would surface any incompatibility at plan verification |
| A6 | `api-key`/`auth-token` defaults in the SDK (`process.env.ANTHROPIC_AUTH_TOKEN`) do not interfere because the resolver always passes an explicit `apiKey` | Pattern 4 | Low — the resolver returns `null` when unset, and the client constructs with an explicit key; a default fallback would only matter if a route constructed the client without resolving (INTG-09 forbids) |

## Open Questions

1. **Anthropic 500-vs-502 convergence.** `report` and `project-report` routes return 500 on AI failure today; `generate-email` variants return 502. CONTEXT says preserve "500/502 as currently used." Options: (a) keep the split in `integrationErrorResponse` per route, (b) converge all to 502 as an explicit HYG-02 behavior change.
   - What we know: 3 of 5 routes use 500, 2 use 502; the split looks arbitrary.
   - What's unclear: whether any client depends on the 500.
   - Recommendation: converge to 502 and call it out; the discuss/plan gate confirms.

2. **`maxRetries` behavior change.** Current code has no retry (raw SDK default 2). Setting `maxRetries: 0` removes the SDK's hidden 2-attempt behavior — a behavior change the milestone's "no timeouts today" trap is specifically about.
   - What we know: SDK default retries 2 (`client.js:73`); each retry re-arms the 120s timer, so worst case exceeds 120s.
   - What's unclear: none — recommend `maxRetries: 0` and note it in the commit (HYG-02).

3. **Where `DEFAULT_FIELDS` (the search FIELDS list incl. customfield IDs) lives.** CONTEXT discretion: constants module in `lib/integrations/jira/` or inline at call site.
   - Recommendation: module-level `const` in `client.ts` — the list is used by exactly one caller today and no other route needs it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test/runtime | ✓ | 25.2.1 local; Docker `node:20-slim` (≥20 meets all deps; `pg`, `exceljs`, `pptxgenjs`, zod have no engines ceiling) | — |
| npm | Install | ✓ | 11.11.0 | — |
| PostgreSQL (`DATABASE_URL`) | Credential resolver integration tests (INTG-08 script) | dev machine may lack it | — | INTG-08 uses the real DB only in the optional verification script; client unit tests need none |
| `TEST_DATABASE_URL` (must end `_test`) | Repo integration suites | unset in this env (Phase 2 finding) | — | Suites `skipIf(!hasTestDb)` — same skip model applies to any DB-backed INTG-08 check |
| Jira Cloud, Anthropic, Resend live endpoints | Manual end-to-end of the 9 routes | network-dependent | — | All client tests mock fetch/SDK; no live calls in CI |
| `@anthropic-ai/sdk` | Anthropic client | ✓ | 0.92.0 | — |
| `zod` | Validation | ✓ (transitive, to be promoted to direct dep) | 4.3.6 | — |

**Missing dependencies with no fallback:** none — all runtime deps installed or network-optional.
**Missing dependencies with fallback:** live external services (Jira/Anthropic/Resend) — mocked in tests; manual smoke after cutover required.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — include this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (installed, `vitest.config.ts` present, Node + jsdom projects) |
| Config file | `vitest.config.ts` (node env includes `{lib,app}/**/*.test.ts`; jsdom includes `{components,app}/**/*.test.tsx`) |
| Quick run command | `npx vitest run lib/integrations` |
| Full suite command | `npm test` (all projects) + `npx tsc --noEmit` + `npx next build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01/02/03 | All Jira/Anthropic/Resend calls inside `lib/integrations/*/client.ts` | other (grep) | `rg -n 'fetch\(|new Anthropic\(|api\.resend\.com|\.atlassian\.' app lib --glob '!**/*.test.*'` → no matches in `app/` | Wave 0 (target: no matches) |
| INTG-04 | Timeout + normalized error per client | unit | `lib/integrations/resend/client.unit.test.ts`, `jira/client.unit.test.ts` (timeout case) | ❌ Wave 0 |
| INTG-05 | Jira response zod-validated; mismatch → logged + 502 | unit | `lib/integrations/jira/client.unit.test.ts` malformed-response case | ❌ Wave 0 |
| INTG-06 | Anthropic output validated at client boundary | unit | `lib/integrations/anthropic/client.unit.test.ts` non-text-block case | ❌ Wave 0 |
| INTG-07 | One credential resolver serves all integrations | unit | `lib/integrations/credentials.unit.test.ts` (per-kind precedence; `''` env case) | ❌ Wave 0 |
| INTG-08 | Per-company resolution preserved before old paths deleted | script + route-level | read-only `scripts/verify-credential-cutover.ts` + `app/api/jira/test/route.test.ts` regression | ❌ Wave 0 |
| INTG-09 | Client never imports a repository | other (grep) | `rg -n '@/lib/repositories|next/server' lib/integrations` → no matches | Wave 0 (target: no matches) |
| INTG-10 | Each client has mocked-response tests incl. malformed case | unit | the three `client.unit.test.ts` suites above | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/integrations`
- **Per wave merge:** `npm test && npx tsc --noEmit`
- **Phase gate:** `npm test`, `npx tsc --noEmit`, `npx next build`, and the two grep boundaries above green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `lib/integrations/{jira,anthropic,resend}/client.unit.test.ts` — INTG-04/05/06/10
- [ ] `lib/integrations/credentials.unit.test.ts` — INTG-07/08 (precedence + empty-string + admin explicit config)
- [ ] `app/api/jira/test/route.test.ts` regression — INTG-08 route-level (mock `@/lib/auth`, mock `@/lib/repositories/jira-config.repo`, stub `process.env`, mock `fetch`) — reuse `app/api/projects/route.test.ts` pattern (`vi.mock('@/lib/auth')`, `vi.mock('@/lib/db')`)
- [ ] `zod` direct install: `npm install zod@^4.3.6` (legitimacy gate OK)
- *(No framework install gap — Vitest harness already shipped in Phase 1)*

## Security Domain

> `security_enforcement: true` in config — include.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Credentials are service-to-service; user auth unchanged (Phase 5/6) |
| V3 Session Management | no | Unchanged this phase |
| V4 Access Control | no | Route auth unchanged (Phase 5/6) |
| V5 Input Validation | yes | zod at every integration client boundary (INTG-05/06); upstream JSON treated as untrusted input |
| V6 Cryptography | no | Basic auth header + `Bearer` tokens pass through; HTTPS only (fixed upstream URLs) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage via error surface (`String(e)` today) | Information Disclosure | `integrationErrorResponse(e)` maps `IntegrationError` to fixed strings; raw SDK/fetch errors are logged server-side, never returned (matches `repoErrorResponse` behavior) |
| Malformed upstream response causing wrong data to render | Tampering | zod `.passthrough()` validation at the client boundary; mismatch → logged `IntegrationError{kind:'validation'}` → 502, no partial value |
| Timeout bypass / hang | DoS | 15s Jira/Resend `AbortController` (timer cleared on success); Anthropic SDK 120s client timeout |
| Credential precedence regression (tenant A's env name collides) | Spoofing | Precedence preserved per integration + INTG-08 per-company verification script before old paths deleted |
| Jira Basic auth header built from untrusted env/DB names | Spoofing | Credentials module is the only builder; `baseUrl` validated (non-empty, `/\/$/` stripped) — matches today's behavior |

## Sources

### Primary (HIGH confidence — installed packages / repo files read this session)
- `node_modules/@anthropic-ai/sdk` v0.92.0 — `client.d.ts:44-52` (client `timeout`), `internal/request-options.d.ts:47` (per-request `timeout`), `client.js:336-367` (`setTimeout(abort, ms)` + `clearTimeout`), `client.js:241-278` (`APIUserAbortError` vs `APIConnectionTimeoutError` on abort), `client.js:63,73` (`DEFAULT_TIMEOUT` 10 min, `maxRetries` default 2), `client.js:440-459` (`options.timeout ?? this.timeout`), `core/error.d.ts:2-49` (error class hierarchy incl. `APIConnectionTimeoutError extends APIConnectionError extends APIError`), `internal/errors.js:6-12` (`isAbortError`), `resources/messages/messages.d.ts:31,435,541-620,875-883` (`Message.content`, `ContentBlock` union, `TextBlock` incl. required `citations`)
- `node_modules/zod` v4.3.6 — package metadata (no engines, no deps), `v4/core/parse.cjs:59-73` (`safeParse` returns `{success:false, error}` shape), exports incl. `./v3`
- `node_modules/vitest` v4.1.10 — `dist/index.d.ts:414-442,465,531,586-597` (`vi.mock` hoisting, `vi.hoisted`, `vi.stubGlobal`/`vi.unstubAllGlobals`)
- `node_modules/next/dist/docs/` v16.2.4 — `04-functions/fetch.md` (extended `fetch`; **memoization "does not apply in Route Handlers"**, `:95`; caching opt-out via `AbortController` signal, `:88-93`), `05-config/01-next-config-js/serverExternalPackages.md` (opt-out list; does **not** include `@anthropic-ai/sdk`), `03-file-conventions/route.md:669` (GET handlers dynamic-by-default since v15)
- Repo files — all 9 route call sites, `lib/api-errors.ts`, `lib/repositories/_helpers.ts`, `lib/repositories/{jira-config,settings}.repo.ts`, `lib/db.ts:89-94` (`company_jira_config` DDL), `package.json` / `package-lock.json` (zod 4.3.6 transitive, peer ranges `^3.25 || ^4`), `vitest.config.ts`, `test/db.ts`, `test/setup-jsdom.ts`, `lib/repositories/jira-config.repo.unit.test.ts`, `app/api/projects/route.test.ts`, `components/jira/JiraSyncDialog.tsx:28-47,175-234`, `app/admin/page.tsx` (admin test dialog `:129-149,550-608`), `next.config.ts`
- Registry (via `npm view` / seam): `zod` 4.4.3 latest / 4.3.6 pinned; package-legitimacy gate → `zod` OK

### Secondary (MEDIUM confidence)
- Phase 2 artifacts `02-01-PLAN.md`, `02-03-SUMMARY.md` — repository conventions, error-mapping pattern, verification commands (committed in repo)

### Tertiary (LOW confidence)
- Vitest-4-vs-3 behavioral delta beyond what the installed `.d.ts` shows (offline this session) — no web search results available; see Assumptions A1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version verified from installed packages or registry
- Architecture: HIGH — client/resolver/error shapes match verified call sites and Phase 2 conventions
- Pitfalls: MEDIUM — behavior-preservation items grounded in read source; Vitest-4 and zod-interop claims are [ASSUMED] (A1/A2)

**Research date:** 2026-08-10
**Valid until:** 2026-09-10 (30 days — stable pinned stack)

## RESEARCH COMPLETE
