# Phase 8: INTG-08 Credential Cutover - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (recommended answers accepted as default per user instruction)

<domain>
## Phase Boundary

Close the INTG-08 gap left by Phase 3: gather per-tenant credential-cutover evidence with `scripts/verify-credential-cutover.ts` against a live `DATABASE_URL`, then delete the marked-dead inline Jira credential blocks in a dedicated HYG-01 commit.

In scope: running the existing read-only cutover script, recording its output, deleting `getJiraCredentials` in `app/api/jira/search/route.ts` and `oldInlineCredentialBlock` in `app/api/jira/fields/route.ts` (plus unused imports those functions leave behind), grepping that live Jira search/fields/test paths resolve only through `resolveJiraCredentials`, checking off INTG-08.

Out of scope: changing credential precedence (locked in Phase 3), rewriting the resolver or Jira client, deleting `scripts/verify-credential-cutover.ts`, Anthropic/Resend behavior, UI, new integrations.

</domain>

<decisions>
## Implementation Decisions

### Cutover Evidence Gate
- Never delete the dead blocks without script evidence. If `DATABASE_URL` is missing or the DB is unreachable, halt — do not delete. INTG-08's defining clause is "verified per configured company **before** the old paths are deleted."
- `DATABASE_URL` is not in the process environment; `.env.local` has the key (uncommitted). Invoke the script so that file is loaded at process start (`npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts` or Node `--env-file=.env.local`). Do not bake dotenv into the script and do not copy the URL into planning docs.
- A zero-row `company_jira_config` table with script exit 0 still counts as evidence (vacuous per-company match) plus the script's anthropic match line. Record the stdout either way.
- Paste the script's stdout verbatim into the plan SUMMARY / VERIFICATION evidence. Exit non-zero or any `match: no` row is a hard stop.

### Deletion Scope
- Delete only the two marked-dead functions: `getJiraCredentials` in `app/api/jira/search/route.ts` and `oldInlineCredentialBlock` in `app/api/jira/fields/route.ts`, including their INTG-08 comments.
- In the same HYG-01 commit, drop imports that become unused (search route currently imports `companyJiraConfig` only for the dead helper). Leave the fields route's live `companyJiraConfig` call — it still distinguishes `Jira chưa cấu hình` vs `Thiếu env vars`.
- Do not touch `app/api/jira/test/route.ts` unless a grep shows leftover inline env-var resolution (live path already uses `resolveJiraCredentials`).
- Do not change `lib/integrations/credentials.ts`. Anthropic `env || db` empty-string normalization stays (Phase 3 locked). Grep Anthropic routes for leftover inline fallbacks; delete them in this same commit only if they still exist.

### Commits & Leftovers
- Evidence run is the gate. Deletion is a dedicated HYG-01 commit so a tenant-config regression bisects to that commit. Message: `refactor(08): delete old inline credential paths after resolver cutover verified (INTG-08, HYG-01)`.
- Keep `scripts/verify-credential-cutover.ts` — it is the evidence tool, not dead code.
- Close the three Phase 3 WINDOWS.md stubs that track these dead blocks / unrun script once the commit lands.

### Verification
- After deletion: boundary greps (no leftover `getJiraCredentials` / `oldInlineCredentialBlock`; live Jira routes call the resolver) plus `npx tsc --noEmit` and `npm test` (HYG-03).
- Mismatch or unreachable DB → stop autonomous execution of the deletion task. Do not force-delete.
- Check off INTG-08 in REQUIREMENTS.md only after evidence + deletion both exist.
- Resolver precedence is frozen: Jira DB-names-then-env, Anthropic env-then-DB, Resend env-only.

### the agent's Discretion
- Exact Node/tsx `--env-file` invocation that successfully loads `.env.local` on this Windows host.
- Whether Anthropic leftover fallbacks still exist (grep decides; do not invent deletions).
- Plan/wave split: a single plan is acceptable for this narrow phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/verify-credential-cutover.ts` — read-only old-vs-new comparison; exits 1 if `DATABASE_URL` unset or any row mismatches; 5s pool connect timeout (WR-06).
- `lib/integrations/credentials.ts` — `resolveJiraCredentials` / `resolveAnthropicCredentials` / `resolveResendCredentials`. Live Jira search/fields/test already call the resolver.
- Dead blocks (unreachable): `getJiraCredentials` (`app/api/jira/search/route.ts`), `oldInlineCredentialBlock` (`app/api/jira/fields/route.ts`).

### Established Patterns
- HYG-01: pure removals in their own commit, gated on evidence.
- Cutover script uses `npx tsx` because Node 25 cannot resolve the `@/` alias (Phase 3 03-01-SUMMARY).
- Fields GET keeps a config-row presence check beside the resolver so the two 503 strings stay distinct (Phase 3 freeze).

### Integration Points
- After delete, search POST and fields GET must still call `resolveJiraCredentials` on the live path. Test route already does (plus explicit admin body var-names).
- REQUIREMENTS.md INTG-08 is `[ ]` and mapped to Phase 3 + Phase 8.

</code_context>

<specifics>
## Specific Ideas

- User instruction for this autonomous run: accept all recommended options.
- Phase 3 already accepted "do not delete without evidence" (03-04-SUMMARY deviation). This phase exists to finish that gated work, not to reopen precedence.
- `.env.local` exists with `DATABASE_URL`; `.env` does not. Do not commit `.env.local` or quote its value.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. HYG-02 Anthropic 500→502 confirmation remains a Phase 3 operator note, not this phase.

</deferred>
