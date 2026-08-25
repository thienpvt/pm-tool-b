# Phase 8: INTG-08 Credential Cutover - Research

**Researched:** 2026-08-25
**Domain:** Credential resolver cutover evidence + dead-code deletion (Jira integration layer)
**Confidence:** HIGH

## Summary

Phase 8 closes the INTG-08 gap deferred from Phase 3. The unified resolver in `lib/integrations/credentials.ts` already serves all live Jira routes (`search`, `fields`, `test`); the old inline credential blocks in `search/route.ts` and `fields/route.ts` are marked unreachable dead code awaiting a gated HYG-01 deletion commit. The phase is intentionally narrow: run the existing read-only comparison script against a live `DATABASE_URL`, record stdout as evidence, delete only the two dead functions (plus unused imports), verify with greps and the existing test suite, check off INTG-08, and close the three WINDOWS.md ledger entries.

Research confirmed the cutover script runs successfully on this Windows host with `npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts` — `.env.local` is present, PostgreSQL is reachable, exit code 0, and with zero `company_jira_config` rows the vacuous per-company match plus `anthropic | match: yes` satisfies the evidence gate. No new libraries, resolver changes, or route behavior changes are in scope.

**Primary recommendation:** Plan as two sequential tasks — (1) capture script stdout verbatim as gate evidence, (2) HYG-01 commit deleting `getJiraCredentials` and `oldInlineCredentialBlock` only — then boundary greps, `npx tsc --noEmit`, `npm test`, REQUIREMENTS checkoff, and WINDOWS ledger closure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Cutover Evidence Gate
- Never delete the dead blocks without script evidence. If `DATABASE_URL` is missing or the DB is unreachable, halt — do not delete. INTG-08's defining clause is "verified per configured company **before** the old paths are deleted."
- `DATABASE_URL` is not in the process environment; `.env.local` has the key (uncommitted). Invoke the script so that file is loaded at process start (`npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts` or Node `--env-file=.env.local`). Do not bake dotenv into the script and do not copy the URL into planning docs.
- A zero-row `company_jira_config` table with script exit 0 still counts as evidence (vacuous per-company match) plus the script's anthropic match line. Record the stdout either way.
- Paste the script's stdout verbatim into the plan SUMMARY / VERIFICATION evidence. Exit non-zero or any `match: no` row is a hard stop.

#### Deletion Scope
- Delete only the two marked-dead functions: `getJiraCredentials` in `app/api/jira/search/route.ts` and `oldInlineCredentialBlock` in `app/api/jira/fields/route.ts`, including their INTG-08 comments.
- In the same HYG-01 commit, drop imports that become unused (search route currently imports `companyJiraConfig` only for the dead helper). Leave the fields route's live `companyJiraConfig` call — it still distinguishes `Jira chưa cấu hình` vs `Thiếu env vars`.
- Do not touch `app/api/jira/test/route.ts` unless a grep shows leftover inline env-var resolution (live path already uses `resolveJiraCredentials`).
- Do not change `lib/integrations/credentials.ts`. Anthropic `env || db` empty-string normalization stays (Phase 3 locked). Grep Anthropic routes for leftover inline fallbacks; delete them in this same commit only if they still exist.

#### Commits & Leftovers
- Evidence run is the gate. Deletion is a dedicated HYG-01 commit so a tenant-config regression bisects to that commit. Message: `refactor(08): delete old inline credential paths after resolver cutover verified (INTG-08, HYG-01)`.
- Keep `scripts/verify-credential-cutover.ts` — it is the evidence tool, not dead code.
- Close the three Phase 3 WINDOWS.md stubs that track these dead blocks / unrun script once the commit lands.

#### Verification
- After deletion: boundary greps (no leftover `getJiraCredentials` / `oldInlineCredentialBlock`; live Jira routes call the resolver) plus `npx tsc --noEmit` and `npm test` (HYG-03).
- Mismatch or unreachable DB → stop autonomous execution of the deletion task. Do not force-delete.
- Check off INTG-08 in REQUIREMENTS.md only after evidence + deletion both exist.
- Resolver precedence is frozen: Jira DB-names-then-env, Anthropic env-then-DB, Resend env-only.

### Claude's Discretion
- Exact Node/tsx `--env-file` invocation that successfully loads `.env.local` on this Windows host.
- Whether Anthropic leftover fallbacks still exist (grep decides; do not invent deletions).
- Plan/wave split: a single plan is acceptable for this narrow phase.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. HYG-02 Anthropic 500→502 confirmation remains a Phase 3 operator note, not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTG-08 | The credential resolver preserves every currently-working tenant configuration — verified per configured company before the old paths are deleted | `scripts/verify-credential-cutover.ts` compares old inline path vs `resolveJiraCredentials` per row; script exit 0 + all `match: yes` is the gate; HYG-01 deletion removes dead blocks only after evidence |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-tenant credential equivalence proof | Scripts / ops (`scripts/verify-credential-cutover.ts`) | Database (`company_jira_config` read) | Read-only gate runs outside the app server; compares old vs new resolution paths against live DB rows and `process.env` |
| Live Jira credential resolution | API / Backend (`lib/integrations/credentials.ts`) | Database (var names in `company_jira_config`) | Routes already delegate to resolver; env values read at runtime from `process.env` |
| Dead inline path removal | API / Backend (`app/api/jira/*/route.ts`) | — | Pure deletion of unreachable functions; no client or DB schema change |
| Env var values for Jira/Anthropic | Deployment platform (Railway/K8s env) | — | DB stores env var **names** only; values must exist in process env at runtime |
| INTG-08 requirement closure | Planning artifacts (`.planning/REQUIREMENTS.md`) | — | Checkbox + recorded stdout evidence after both gate and deletion complete |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tsx` | 4.23.12 (via `npx tsx`) | Run TypeScript script with `@/` alias | Plain Node does not resolve tsconfig paths; Phase 3 established `npx tsx` as the working invocation [VERIFIED: shell probe this session] |
| `pg` | ^8.20.0 | Script opens its own Pool for `company_jira_config` SELECT | Already a project dependency; script uses 5s connection timeout [VERIFIED: scripts/verify-credential-cutover.ts:57] |
| `@/lib/integrations/credentials` | in-repo | New-path comparison in cutover script | Single resolver module — do not duplicate logic [VERIFIED: lib/integrations/credentials.ts:19-30] |
| Vitest | 4.1.10 | Post-deletion regression (`npm test`) | Existing harness; Jira route tests mock resolver [VERIFIED: package.json:49, vitest.config.ts] |
| TypeScript | ^5 | `npx tsc --noEmit` gate | Project standard compile check |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node `--env-file` | Node 20+ (host: v24.14.0) | Load `.env.local` at process start | Preferred over adding dotenv to the script [VERIFIED: shell probe — `node --help` lists `--env-file`; successful script run with `--env-file=.env.local`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `npx tsx --env-file=.env.local` | `dotenv` in script | CONTEXT forbids baking dotenv into the script; `--env-file` is zero-dependency |
| `node scripts/...` | `npx tsx scripts/...` | Plain Node 25/24 cannot resolve `@/` alias — script fails at import [VERIFIED: scripts/verify-credential-cutover.ts:16-18 comment] |
| Manual per-tenant curl tests | Cutover script | Script compares old vs new paths byte-for-byte for every row; manual testing misses tenants |

**Installation:** None — phase uses existing dependencies and `npx tsx` (not pinned in `package.json`; fetched on demand by npx).

## Package Legitimacy Audit

> No new external packages are installed in this phase.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| — | — | — | No installs required |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│  Operator (Windows / PowerShell)                                 │
│  npx tsx --env-file=.env.local scripts/verify-credential-cutover│
└────────────────────────────┬────────────────────────────────────┘
                             │ loads DATABASE_URL + Jira env vars
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  verify-credential-cutover.ts (READ-ONLY)                        │
│  1. Pool.query → company_jira_config rows                        │
│  2. Per row: oldJiraPath(row) vs resolveJiraCredentials(id)      │
│  3. Global: oldAnthropicPath() vs resolveAnthropicCredentials()  │
│  4. Print match: yes/no; exit 1 on any mismatch                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ exit 0 + all match: yes
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  HYG-01 deletion commit (gated — only after evidence)            │
│  DELETE getJiraCredentials (search/route.ts)                     │
│  DELETE oldInlineCredentialBlock (fields/route.ts)               │
│  DROP unused companyJiraConfig import (search only)              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Live Jira API routes (unchanged behavior)                       │
│  search POST ──► resolveJiraCredentials(companyId) ──► client    │
│  fields GET  ──► companyJiraConfig (503 split)                   │
│              ──► resolveJiraCredentials(companyId) ──► client    │
│  test GET/POST ──► resolveCfg ──► resolveJiraCredentials(null,cfg)│
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new files. Touch only:

```text
scripts/verify-credential-cutover.ts     # KEEP — evidence tool
app/api/jira/search/route.ts             # DELETE dead getJiraCredentials block
app/api/jira/fields/route.ts             # DELETE dead oldInlineCredentialBlock
.planning/REQUIREMENTS.md                 # Check off INTG-08 + evidence note
.planning/WINDOWS.md                     # Close 3 ledger entries
```

### Pattern 1: Evidence-Gated Pure Deletion (HYG-01)

**What:** Run read-only verification script; capture stdout; only then commit pure removals with no behavior change.

**When to use:** Any cutover where old code is preserved as bisectable dead code until equivalence is proven.

**Example:**

```powershell
# Windows — load .env.local without dotenv in script
npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts
# Expect per-row:  {company_id} | old: OK|UNSET | new: OK|UNSET | match: yes
# Expect global:   anthropic | old: ... | new: ... | match: yes
# Exit code must be 0
```

### Pattern 2: Fields Route Two-503 Split (preserve after deletion)

**What:** `companyJiraConfig` presence check stays in the route; resolver null alone cannot distinguish the two Vietnamese 503 strings.

**When to use:** Do not collapse the config-row check into the resolver — Phase 3 behavior freeze.

**Example:**

```typescript
// Live path — KEEP in fields/route.ts [VERIFIED: app/api/jira/fields/route.ts:15-19]
const cfg = await companyJiraConfig(user.company_id);
if (!cfg?.base_url_var) return NextResponse.json({ error: 'Jira chưa cấu hình' }, { status: 503 });
const creds = await resolveJiraCredentials(user.company_id);
if (!creds) return NextResponse.json({ error: 'Thiếu env vars' }, { status: 503 });
```

### Pattern 3: Test Route Diagnostic vs Credential Resolution

**What:** `process.env[cfg.*_var]` reads in `test/route.ts` lines 63–67 are **name-level presence checks** for the operator diagnostic string — not credential resolution. Values flow only through `resolveJiraCredentials(null, cfg)`.

**When to use:** Do not delete or "fix" these reads during Phase 8; grep must distinguish diagnostic reads from inline credential resolution.

### Anti-Patterns to Avoid

- **Deleting dead blocks before script evidence:** Violates INTG-08 defining clause and CONTEXT hard stop.
- **Removing `companyJiraConfig` from fields route:** Breaks the two distinct 503 error strings.
- **Changing resolver precedence:** Locked — Jira DB-names-then-env, Anthropic env-then-DB.
- **Using plain `node scripts/verify-credential-cutover.ts`:** Fails on `@/` import resolution.
- **Adding dotenv to the cutover script:** CONTEXT explicitly forbids; use `--env-file`.
- **Copying DATABASE_URL into RESEARCH/PLAN docs:** Security leak; note file presence only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Old-vs-new credential comparison | Ad-hoc SQL + manual curl per tenant | `scripts/verify-credential-cutover.ts` | Already implements verbatim old paths + unified resolver; exits non-zero on mismatch |
| Loading `.env.local` in script | `dotenv/config` import | `npx tsx --env-file=.env.local` | Zero code change; CONTEXT locked |
| New integration tests for deletion | Duplicate resolver tests | Existing `credentials.unit.test.ts` + `jira/test/route.test.ts` | Deletion is unreachable-code removal; live paths already tested in Phase 3 |
| Credential resolution in routes | Inline `process.env[cfg.*]` for values | `resolveJiraCredentials` | INTG-07/INTG-08 — single resolver |

**Key insight:** The hard work (resolver + comparison script) shipped in Phase 3. Phase 8 is operational execution of the gate plus surgical deletion.

## Common Pitfalls

### Pitfall 1: Script Runs Without Env File

**What goes wrong:** `DATABASE_URL` unset → script prints `set DATABASE_URL and re-run`, exit 1; planner might still schedule deletion.

**Why it happens:** `.env.local` is not loaded into the shell environment by default.

**How to avoid:** Always invoke with `--env-file=.env.local`; treat exit non-zero as hard stop for deletion task.

**Warning signs:** stderr contains `set DATABASE_URL and re-run`.

### Pitfall 2: `match: no` With Partial Env

**What goes wrong:** A tenant has DB var names configured but Railway env missing one value — old and new both return null, but if logic ever diverged, mismatch would block deletion.

**Why it happens:** Real multi-tenant configs with incomplete env deployment.

**How to avoid:** Fix env deployment before deletion; do not force-delete or patch the script to ignore mismatches.

**Warning signs:** Output line contains `match: no`.

### Pitfall 3: Over-Deleting in search/route.ts

**What goes wrong:** Removing live imports or the `resolveJiraCredentials` call along with dead code.

**Why it happens:** Dead block sits above live POST handler in the same file.

**How to avoid:** Delete only lines 8–26 (`getJiraCredentials` + INTG-08 comment block) and the now-unused `companyJiraConfig` import; preserve POST handler unchanged [VERIFIED: app/api/jira/search/route.ts:28-84 live path].

**Warning signs:** POST no longer calls `resolveJiraCredentials`.

### Pitfall 4: WINDOWS Ledger Left Open

**What goes wrong:** `/gsd-ship` blocks with 3 open stubs after code is clean.

**How to avoid:** Mark fixed entries 1–3 in `.planning/WINDOWS.md` after HYG-01 commit lands.

### Pitfall 5: Anthropic Empty-String Normalization Mismatch

**What goes wrong:** Script's `oldAnthropicPath` uses `if (envKey) return envKey` while resolver uses `env || db` — they agree on empty string (both fall through to DB) [VERIFIED: scripts/verify-credential-cutover.ts:43-46, lib/integrations/credentials.ts:37-38].

**How to avoid:** Do not change either path in this phase.

## Code Examples

### Cutover Script Invocation (Windows)

```powershell
# Source: Phase 8 CONTEXT + verified this session
npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts
echo $LASTEXITCODE   # must be 0
```

### Expected Script Output Shape

```text
# Per configured company (zero rows = no lines — still valid)
{company_id} | old: OK|UNSET | new: OK|UNSET | match: yes

# Always printed
anthropic | old: OK|UNSET | new: OK|UNSET | match: yes
```

### Deletion Scope — search/route.ts

Remove dead block only [VERIFIED: app/api/jira/search/route.ts:8-26]:

```typescript
// DELETE: lines 8-26 (INTG-08 comment + getJiraCredentials function)
// DELETE: import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';
// KEEP: resolveJiraCredentials import and POST handler (lines 28-84)
```

### Deletion Scope — fields/route.ts

Remove dead block only [VERIFIED: app/api/jira/fields/route.ts:29-43]:

```typescript
// DELETE: lines 29-43 (INTG-08 comment + oldInlineCredentialBlock function)
// KEEP: companyJiraConfig import and live GET handler (lines 8-27)
```

### Post-Deletion Boundary Greps

```powershell
# Must return zero matches in app/ (script name OK in scripts/)
rg "getJiraCredentials|oldInlineCredentialBlock" app/

# Must return 3 production call sites
rg "resolveJiraCredentials\(" app/api/jira/

# Anthropic inline fallbacks — expect zero in routes (resolver only)
rg "getSetting\('anthropic_api_key'\)" app/api/
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline Jira credential blocks per route | `resolveJiraCredentials` in `lib/integrations/credentials.ts` | Phase 3 (03-04) | Live paths rewired; dead blocks preserved for HYG-01 bisect |
| Phase 3 cutover in same commit as rewire | Phase 8 dedicated cutover phase | 2026-08-25 roadmap | Evidence + deletion separated from behavior-changing rewire |
| INTG-08 marked complete | INTG-08 open, Phase 8 owner | 03-VERIFICATION re-check | Checkbox reflects outstanding gate |

**Deprecated/outdated:**
- `getJiraCredentials` in search route: unreachable dead code — delete in Phase 8 HYG-01 commit.
- `oldInlineCredentialBlock` in fields route: unreachable dead code — delete in Phase 8 HYG-01 commit.
- `.planning/codebase/INTEGRATIONS.md` line 119 still references old `getJiraCredentials` pattern — out of scope for Phase 8 code but planner may note doc drift.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Production DB may gain `company_jira_config` rows between evidence run and deletion; re-run script if rows change | Evidence Gate | Stale evidence if tenants added mid-phase |
| A2 | Jira env var **values** referenced by DB var names are present in `.env.local` when testing locally | Environment | Script reports UNSET/match:yes for missing values (both paths null) — still passes but does not prove OK resolution |
| A3 | No Anthropic inline fallbacks remain in `app/api/` routes | Deletion Scope | Grep shows only `resolveAnthropicCredentials` in report routes — no extra deletions needed [VERIFIED: grep this session] |

## Open Questions

1. **Will production have `company_jira_config` rows at cutover time?**
   - What we know: Local `.env.local` DB returned zero rows; script exit 0 with anthropic match only.
   - What's unclear: Production/Railway tenant count.
   - Recommendation: Re-run script against the target environment immediately before deletion; any new row must show `match: yes`.

None blocking planning — executor follows hard stop rules on mismatch.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tsx, tsc, vitest | ✓ | v24.14.0 | — |
| npm / npx | tsx invocation | ✓ | 11.9.0 | — |
| `npx tsx` | `@/` alias in script | ✓ | tsx 4.23.12 | None — required |
| Node `--env-file` | Load `.env.local` | ✓ | Node 20+ flag | None — do not add dotenv |
| `.env.local` with `DATABASE_URL` | Cutover script | ✓ (present, uncommitted) | — | Halt if missing |
| PostgreSQL (reachable) | Cutover script + app | ✓ (script exit 0 this session) | via `pg` ^8.20.0 | Halt — no fallback |
| Jira env vars in process | Per-tenant OK rows | ? (depends on tenant config) | — | UNSET rows still match if both paths null |

**Missing dependencies with no fallback:**
- Reachable `DATABASE_URL` — blocks deletion task entirely.

**Missing dependencies with fallback:**
- None.

**Research session probe (no secrets recorded):**

```text
Command: npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts
Result: exit 0
Output shape: anthropic | old: UNSET | new: UNSET | match: yes
              (zero company_jira_config rows — no per-company lines)
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run app/api/jira/test lib/integrations/credentials.unit.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-08 | Resolver matches old inline path per tenant | manual/script | `npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts` | ✅ script exists |
| INTG-08 | Live Jira routes use resolver after deletion | grep + unit | `rg resolveJiraCredentials app/api/jira/` + `npm test` | ✅ existing tests |
| INTG-08 | No dead function names remain | grep | `rg getJiraCredentials\|oldInlineCredentialBlock app/` | ✅ Wave 0 N/A |
| HYG-03 | Type safety after deletion | compile | `npx tsc --noEmit` | ✅ |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` + targeted `npx vitest run app/api/jira/test`
- **Per wave merge:** `npm test`
- **Phase gate:** Script evidence recorded + full suite green + boundary greps

### Wave 0 Gaps

None — existing test infrastructure covers post-deletion regression. No new tests required for pure dead-code removal (HYG-01). The cutover script itself is the INTG-08 behavioral proof for tenant equivalence.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | Route auth unchanged |
| V5 Input Validation | no | No new inputs |
| V6 Cryptography | yes | Never log or commit credential values; script prints OK/UNSET labels only [VERIFIED: scripts/verify-credential-cutover.ts:73-74,82-84] |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage in planning docs | Information disclosure | Record stdout shape only; never copy DATABASE_URL or tokens into RESEARCH/PLAN |
| Running cutover against wrong DB | Tampering / mis-verification | Confirm `.env.local` points at intended environment before recording evidence |
| Skipping gate and deleting early | Integrity | CONTEXT hard stop; exit non-zero or `match: no` blocks deletion |

## Sources

### Primary (HIGH confidence)

- `scripts/verify-credential-cutover.ts` — full script read this session
- `lib/integrations/credentials.ts:19-48` — resolver implementations
- `app/api/jira/search/route.ts`, `fields/route.ts`, `test/route.ts` — live vs dead paths via codegraph + read
- Phase 8 `08-CONTEXT.md` — locked decisions
- Successful script execution with `--env-file=.env.local` this session

### Secondary (MEDIUM confidence)

- `.planning/phases/03-integration-clients/03-04-SUMMARY.md` — Phase 3 gate blockage rationale
- `.planning/phases/03-integration-clients/03-VERIFICATION.md` — INTG-08 deferral acceptance
- `.planning/WINDOWS.md` — three open ledger entries to close

### Tertiary (LOW confidence)

- `.planning/codebase/INTEGRATIONS.md` — may be stale (still references old pattern); not re-verified against live code beyond Phase 3

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; tsx/`--env-file` invocation verified on host
- Architecture: HIGH — dead vs live code paths identified with line ranges; Phase 3 patterns documented
- Pitfalls: HIGH — gate rules explicit in CONTEXT; script behavior read verbatim

**Research date:** 2026-08-25
**Valid until:** 2026-09-25 (stable ops phase; re-run script if tenant config changes)
