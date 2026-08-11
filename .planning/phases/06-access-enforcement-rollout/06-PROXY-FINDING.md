# ROUTE-11 Finding: Does proxy.ts execute in the deployed standalone runtime?

**Date:** 2026-08-11
**Verified by:** empirical local-prod-runtime test (standalone build + live curl), not static inference alone.

## Question

Does `proxy.ts` execute in the deployed standalone runtime, or is the session-gate redirect it
implements dead code that route-level enforcement (Phase 4-6) has to fully cover on its own?

## Evidence A (static manifests)

`middleware-manifest.json` is empty in BOTH builds:

Standalone (`.next/standalone/PyCharmMiscProject/pm-tool-b/.next/server/middleware-manifest.json`):
```json
{
  "version": 3,
  "middleware": {},
  "sortedMiddleware": [],
  "functions": {}
}
```

Non-standalone (`.next/server/middleware-manifest.json`):
```json
{
  "version": 3,
  "middleware": {},
  "sortedMiddleware": [],
  "functions": {}
}
```

`.next/server/middleware.js` exists (221 bytes) and is a thin re-export shim:
```js
var R=require("./chunks/[turbopack]_runtime.js")("server/middleware.js")
R.c("server/chunks/[externals]__05537z6._.js")
R.c("server/chunks/[root-of-the-server]__0t0xbu1._.js")
R.m(14261)
module.exports=R.m(14261).exports
```

It loads chunk `[root-of-the-server]__0t0xbu1._.js` (188KB), which was grepped and confirmed to
contain both `pm_session` (the proxy's cookie name) and `/api/health` (the proxy's PUBLIC list
entry) — proving the proxy's compiled code is present in the runtime bundle.

**Taken alone, `middleware-manifest.json` being empty looks like a dead-dispatch signal — but it
is a red herring.** A second manifest, `functions-config-manifest.json`, exists in both builds and
DOES register the proxy:

```json
{
  "version": 1,
  "functions": {
    "/_middleware": {
      "runtime": "nodejs",
      "matchers": [
        {
          "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|favicon.ico).*))(\\.json)?[\\/#\\?]?$",
          "originalSource": "/((?!_next/static|_next/image|favicon.ico).*)"
        }
      ]
    }
  }
}
```

This matches `proxy.ts`'s `config.matcher` (`/((?!_next/static|_next/image|favicon.ico).*)`)
verbatim. In Next 16.2.4, `functions-config-manifest.json` — not `middleware-manifest.json` — is
what the standalone server actually reads to know a proxy function exists and should be
dispatched via `/_middleware`. Static inspection of a single manifest file was insufficient and
would have produced a false "dead code" conclusion; the empirical runtime test below is what
settles the question.

## Evidence B (local production runtime — the decisive evidence)

Standalone build already existed (BUILD_ID `xLnbp5BNdZF1HFp0Fb1Xi`), reused rather than rebuilt.
Started it locally:

```bash
cd .next/standalone/PyCharmMiscProject/pm-tool-b
PORT=3001 HOSTNAME=127.0.0.1 NODE_ENV=production \
  DATABASE_URL="postgres://dummy:dummy@localhost:5432/dummy" \
  node server.js
```

Server came up (`✓ Ready in 0ms` on `http://127.0.0.1:3001`).

**Test 1 — protected page, no cookie:**
```bash
curl -i http://127.0.0.1:3001/portfolio
```
```
HTTP/1.1 307 Temporary Redirect
location: /login?from=%2Fportfolio
```
→ **This is proxy.ts's exact redirect behavior** (`NextResponse.redirect` to `/login` with a
`from` query param set to the original pathname). No session cookie was sent, and the response is
a 307 redirect, not a 200 HTML page.

**Test 2 — protected API path, no cookie:**
```bash
curl -i http://127.0.0.1:3001/api/portfolio
```
```
HTTP/1.1 307 Temporary Redirect
location: /login?from=%2Fapi%2Fportfolio
```
→ `/api/portfolio` is NOT in proxy's `PUBLIC` list, so it is caught upstream by the proxy exactly
like a page route, before ever reaching the route handler's own session check.

**Test 3 — public path (`/api/health`), no cookie, control case:**
```bash
curl -i http://127.0.0.1:3001/api/health
```
```
HTTP/1.1 200 OK
content-type: application/json
{"ok":true}
```
→ Passes straight through with 200, exactly matching `PUBLIC` including `/api/health` — confirms
the proxy's allowlist branch (`NextResponse.next()`) is also live, not just the redirect branch.

**Test 4 — public path (`/login`), no cookie, control case:**
```bash
curl -i http://127.0.0.1:3001/login
```
```
HTTP/1.1 200 OK
x-nextjs-prerender: 1
```
→ Also passes through, confirming `/login` itself isn't redirect-looped.

Server was stopped after the check (`taskkill //F //PID <pid>` on the `node server.js` process;
verified via `netstat -ano` that the listening socket on port 3001 is gone, only stale
`TIME_WAIT` entries from already-closed client connections remain).

## Naming check

The Next 16.2.4 installed docs
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) confirm:
"The file must export a single function, either as a default export or named `proxy`." This
project's `proxy.ts` uses `export function proxy(...)` — the correct, current convention (renamed
from `middleware` in this Next version). There is no naming bug.

## Conclusion

**proxy.ts DOES execute in the deployed standalone runtime.** It is not dead code. The empty
`middleware-manifest.json` is not a reliable signal of proxy dispatch in this Next version —
`functions-config-manifest.json` is the manifest that matters, and it correctly registers the
proxy's matcher. The live curl test is unambiguous: unauthenticated requests to protected paths
(`/portfolio`, `/api/portfolio`) get 307 redirects to `/login?from=<original-path>` — proxy's
exact behavior — while allowlisted paths (`/login`, `/api/health`) pass through with 200.

This means enforcement in production is **two layers deep**, not one:
1. **proxy.ts** (upstream, cookie-presence check only — does not verify the session is valid,
   just that a `pm_session` cookie exists) redirects unauthenticated *page and API* requests
   for any non-`PUBLIC` path to `/login`.
2. **Route-level enforcement** (Phase 4-6 wrappers and gates, verified by the 401 matrix in
   06-06) is the layer that does the *real* session validation (DB lookup, expiry, company scope)
   and returns proper 401/403 JSON for API callers that do have a stale/invalid cookie or that
   bypass the proxy (e.g. direct server-to-server calls, or any future deployment target where
   the proxy doesn't run).

Route-level enforcement remains necessary and is not redundant: proxy.ts only checks cookie
*presence*, not validity, and only redirects (unsuitable for API clients expecting JSON 401s
instead of a 307 to an HTML login page). The 8 previously-unprotected routes gated in Plan 06-02
are correctly self-gated regardless of proxy.ts's runtime behavior.

## Recommendation / deferred

None needed for this milestone — no fix required. proxy.ts is confirmed working as designed in
the deployed standalone runtime; route-level enforcement (proven via the 06-06 401 matrix)
provides defense-in-depth underneath it. Nothing is deferred to v2 for ROUTE-11.

One documentation note for future maintainers: do not use `middleware-manifest.json` alone to
infer whether a proxy/middleware function is live in a Next 16.2.4 standalone build — it can read
as empty while `functions-config-manifest.json` shows the function correctly registered and the
runtime dispatches it. Confirm with a live curl test against the standalone build, not manifest
inspection alone.
