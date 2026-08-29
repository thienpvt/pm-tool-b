import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { findUserByUsername, setUserPasswordHash, userPasswordHash } from './auth.repo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('auth.repo (obsolete after Kysely migration — see auth.repo.test.ts)', () => {
  it('loads the login row by username', async () => {
    db.get.mockResolvedValue({ id: 4, username: 'ava' });

    await expect(findUserByUsername('ava')).resolves.toMatchObject({ id: 4, username: 'ava' });
    expect(db.get).toHaveBeenCalledWith('SELECT * FROM users WHERE username = ?', 'ava');
  });

  it('reads and writes password hashes with an explicit user id', async () => {
    db.get.mockResolvedValue({ password_hash: 'old-hash' });
    db.run.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });

    await expect(userPasswordHash(4)).resolves.toEqual({ password_hash: 'old-hash' });
    await expect(setUserPasswordHash(4, 'new-hash')).resolves.toEqual({
      lastInsertRowid: 0,
      changes: 1,
    });
    expect(db.run).toHaveBeenCalledWith(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      'new-hash',
      4,
    );
  });

  it('propagates database failures to the route layer', async () => {
    db.get.mockRejectedValue(new Error('database unavailable'));

    await expect(findUserByUsername('ava')).rejects.toThrow('database unavailable');
  });
});
