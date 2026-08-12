// Pins the proxy matcher regex: static assets must bypass auth, pages must not.
// Regression guard for the broken-logo bug — /shb-logo.svg was matching the
// proxy, getting redirected to /login, and rendering as a broken image.
// Run: node proxy.matcher.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Extract the matcher pattern from proxy.ts rather than duplicating it here,
// so the test fails if the real pattern drifts.
const src = readFileSync(new URL('./proxy.ts', import.meta.url), 'utf8');
const m = src.match(/matcher:\s*\[\s*'([^']+)'/);
assert.ok(m, 'could not find matcher pattern in proxy.ts');

// The matcher is a path-to-regexp source string; the escaping is already
// JS-string-escaped in the source, so unescape one level.
const pattern = m[1].replace(/\\\\/g, '\\');
const re = new RegExp(`^${pattern}$`);

const bypasses = [
  '/shb-logo.svg',
  '/shb-logo.png',
  '/favicon.ico',
  '/next.svg',
  '/fonts/inter.woff2',
  '/_next/static/chunk.js',
  '/_next/image',
];
const matches = [
  '/',
  '/login',
  '/landing',
  '/projects',
  '/projects/abc-123',
  '/api/projects',
  '/api/auth/login',
];

for (const p of bypasses) {
  assert.equal(re.test(p), false, `${p} should BYPASS the proxy (static asset)`);
}
for (const p of matches) {
  assert.equal(re.test(p), true, `${p} should MATCH the proxy (needs auth check)`);
}

console.log(`ok — ${bypasses.length} bypass + ${matches.length} match cases pass`);
