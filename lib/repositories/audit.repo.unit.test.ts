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

describe('audit.repo listAuditLogs', () => {
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
