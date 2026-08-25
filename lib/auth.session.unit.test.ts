import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { extendSession, getSessionUser } from './auth';

const activeRow = {
  id: 1,
  username: 'ava',
  display_name: 'Ava',
  company_id: 5,
  is_admin: 0,
  onboarding_completed: 1,
  email: 'ava@example.com',
  status: 'active',
  roles: ['pm'],
  company_name: 'Acme',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extendSession', () => {
  it('UPDATEs expires_at for an unexpired session and returns true', async () => {
    db.run.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });

    await expect(extendSession('session-abc')).resolves.toBe(true);

    expect(db.run).toHaveBeenCalledTimes(1);
    const [sql, expiresAt, sessionId, now] = db.run.mock.calls[0];
    expect(sql).toContain('UPDATE sessions SET expires_at = ?');
    expect(sql).toContain('WHERE id = ? AND expires_at > ?');
    expect(sessionId).toBe('session-abc');
    expect(typeof expiresAt).toBe('string');
    expect(typeof now).toBe('string');
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns false when the session is missing or already expired', async () => {
    db.run.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });

    await expect(extendSession('missing-or-expired')).resolves.toBe(false);

    expect(db.run).toHaveBeenCalledTimes(1);
    expect(db.run.mock.calls[0][2]).toBe('missing-or-expired');
  });
});

describe('getSessionUser', () => {
  it('deletes the session and returns null when status is locked', async () => {
    db.get.mockResolvedValue({ ...activeRow, status: 'locked' });
    db.run.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });

    await expect(getSessionUser('session-locked')).resolves.toBeNull();

    expect(db.run).toHaveBeenCalledWith('DELETE FROM sessions WHERE id = ?', 'session-locked');
  });

  it('deletes the session and returns null when status is inactive', async () => {
    db.get.mockResolvedValue({ ...activeRow, status: 'inactive' });
    db.run.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });

    await expect(getSessionUser('session-inactive')).resolves.toBeNull();

    expect(db.run).toHaveBeenCalledWith('DELETE FROM sessions WHERE id = ?', 'session-inactive');
  });

  it('returns SessionUser including roles for an active unexpired session', async () => {
    db.get.mockResolvedValue(activeRow);

    await expect(getSessionUser('session-active')).resolves.toEqual({
      ...activeRow,
      roles: ['pm'],
    });
    expect(db.run).not.toHaveBeenCalled();
  });
});
