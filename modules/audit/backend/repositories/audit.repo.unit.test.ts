import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import * as auditRepo from './audit.repo';
import { listAuditLogs } from './audit.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.all.mockResolvedValue([]);
});

function normalizedSql(): string {
  return db.all.mock.calls[0][0].replace(/\s+/g, ' ').trim();
}

describe.skip('audit.repo listAuditLogs (obsolete after Kysely migration — see audit.repo.test.ts)', () => {
  it('always filters by company_id = ? with the actor company as first param (D-05)', async () => {
    await listAuditLogs(5);
    expect(normalizedSql()).toContain('company_id = ?');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5, 50);
  });

  it('does not omit the company predicate — foreign company rows excluded in SQL (D-05)', async () => {
    db.all.mockResolvedValue([{ id: 1, company_id: 5, entity_id: 'a' }]);
    const rows = await listAuditLogs(5);
    expect(rows.every(r => r.company_id === 5)).toBe(true);
    expect(normalizedSql()).toMatch(/company_id = \?/);
    const params = db.all.mock.calls[0].slice(1);
    expect(params[0]).toBe(5);
  });

  it('adds optional entity_type and entity_id predicates (D-06)', async () => {
    await listAuditLogs(5, { entity_type: 'user', entity_id: '10', limit: 25 });
    expect(normalizedSql()).toContain('entity_type = ?');
    expect(normalizedSql()).toContain('entity_id = ?');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5, 'user', '10', 25);
  });

  it('adds inclusive from/to calendar-day bounds on created_at (D-06)', async () => {
    await listAuditLogs(5, { from: '2026-01-01', to: '2026-01-31', limit: 50 });
    expect(normalizedSql()).toContain('created_at >= ?::date');
    expect(normalizedSql()).toContain('created_at < (?::date + INTERVAL');
    expect(db.all).toHaveBeenCalledWith(
      expect.any(String),
      5,
      '2026-01-01',
      '2026-01-31',
      50,
    );
  });

  it('binds LIMIT to the clamped limit value (D-06)', async () => {
    await listAuditLogs(5, { limit: 200 });
    const params = db.all.mock.calls[0].slice(1);
    expect(params[params.length - 1]).toBe(200);
  });
});

describe.skip('audit.repo append-only persistence (obsolete after Kysely migration)', () => {
  it('keeps the first row unchanged after a second insert for the same entity_id', async () => {
    const store: Array<Record<string, unknown>> = [];
    let nextId = 1;
    db.run.mockImplementation(async (_sql: string, ...params: unknown[]) => {
      store.push({
        id: nextId++,
        company_id: params[1],
        actor_id: params[0],
        entity_type: params[2],
        entity_id: params[3],
        action: params[4],
        before: params[5],
        after: params[6],
        created_at: `2026-01-0${store.length + 1}T00:00:00.000Z`,
      });
      return { lastInsertRowid: store.length, changes: 1 };
    });
    db.all.mockImplementation(async (_sql: string, ...params: unknown[]) => {
      const companyId = params[0];
      return store
        .filter(r => r.company_id === companyId)
        .map(r => ({
          ...r,
          before: r.before == null ? null : JSON.parse(String(r.before)),
          after: r.after == null ? null : JSON.parse(String(r.after)),
        }))
        .sort((a, b) => Number(b.id) - Number(a.id));
    });

    const { insertAuditLog: insert } = await import('./audit.repo');
    await insert({
      actor_id: 1,
      company_id: 5,
      entity_type: 'user',
      entity_id: '42',
      action: 'create',
      before: null,
      after: { username: 'first' },
    });
    await insert({
      actor_id: 2,
      company_id: 5,
      entity_type: 'user',
      entity_id: '42',
      action: 'update',
      before: { username: 'first' },
      after: { username: 'second' },
    });

    const rows = await listAuditLogs(5);
    expect(rows).toHaveLength(2);
    const first = rows.find(r => r.actor_id === 1)!;
    expect(first.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(first.before).toBeNull();
    expect(first.after).toEqual({ username: 'first' });
  });
});

describe('audit.repo immutability (D-04)', () => {
  it('module source has no UPDATE or DELETE on audit_logs', () => {
    const src = readFileSync(resolve(__dirname, 'audit.repo.ts'), 'utf8');
    expect(src).not.toMatch(/UPDATE\s+audit_logs/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+audit_logs/i);
    expect(src).not.toMatch(/UPDATE\s+audit\b/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+audit\b/i);
  });

  it('exports insertAuditLog and listAuditLogs only — no update/delete helpers (D-04)', () => {
    expect(auditRepo).toHaveProperty('insertAuditLog');
    expect(auditRepo).toHaveProperty('listAuditLogs');
    expect(auditRepo).not.toHaveProperty('updateAuditLog');
    expect(auditRepo).not.toHaveProperty('deleteAuditLog');
  });
});
