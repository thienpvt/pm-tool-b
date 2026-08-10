/**
 * Self-check for lib/log.ts — run with: npx tsx lib/log.test.ts
 *
 * Guards the two things that would silently break the logs: query strings
 * leaking into output, and the request-id correlation going missing.
 */
import assert from 'node:assert';
import { REQUEST_ID_HEADER, logError, logRequest, newRequestId, requestId, serverError } from './log';

const lines: string[] = [];
const origLog = console.log;
const origErr = console.error;
console.log = (...a: unknown[]) => void lines.push(a.join(' '));
console.error = (...a: unknown[]) => void lines.push(a.join(' '));

function req(url: string, method = 'GET', id?: string): Request {
  return new Request(url, {
    method,
    headers: id ? { [REQUEST_ID_HEADER]: id } : {},
  });
}

async function main() {
// ── request ids are short and unique ──────────────────────────────────────────
const a = newRequestId();
assert.equal(a.length, 8, 'id should be 8 chars');
assert.notEqual(a, newRequestId(), 'ids must differ');

// ── id is read back off the request; missing id degrades to '-' ────────────────
assert.equal(requestId(req('http://x/api/p', 'GET', 'abc123')), 'abc123');
assert.equal(requestId(req('http://x/api/p')), '-');

// ── query strings must NOT reach the log (ids / search terms) ──────────────────
lines.length = 0;
logError(req('http://x/api/projects?token=SECRET&q=hunter2'), new Error('boom'), 500);
const errLine = lines.join('\n');
assert.ok(!errLine.includes('SECRET'), 'query string must not be logged');
assert.ok(!errLine.includes('hunter2'), 'query string must not be logged');
assert.ok(errLine.includes('/api/projects'), 'path should be logged');
assert.ok(errLine.includes('boom'), 'error message should be logged');
assert.ok(errLine.includes('500'), 'status should be logged');

// ── non-Error throws still log (routes throw strings via String(e) paths) ──────
lines.length = 0;
logError(req('http://x/api/p'), 'plain string failure', 500);
assert.ok(lines.join('\n').includes('plain string failure'));

// ── serverError preserves body + status exactly (no API contract change) ───────
lines.length = 0;
const res = serverError(req('http://x/api/p', 'POST', 'id42'), new Error('db down'), { error: 'db down' }, 502);
assert.equal(res.status, 502, 'status must pass through');
assert.ok(lines.join('\n').includes('id42'), 'must correlate with the [req] line');
const body = await res.json();
assert.deepEqual(body, { error: 'db down' }, 'body must pass through untouched');

// default status is 500
assert.equal(serverError(req('http://x/api/p'), new Error('x'), { error: 'x' }).status, 500);

// ── logRequest marks session presence without logging the cookie ───────────────
lines.length = 0;
logRequest('id7', 'POST', '/api/projects', true);
const reqLine = lines.join('\n');
assert.ok(reqLine.includes('id7') && reqLine.includes('POST') && reqLine.includes('/api/projects'));
assert.ok(reqLine.includes('sess=y'));

console.log = origLog;
console.error = origErr;
console.log('lib/log.ts self-check: all assertions passed');
}

main();
