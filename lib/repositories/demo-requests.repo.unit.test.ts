import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { createDemoRequest } from './demo-requests.repo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('demo-requests.repo', () => {
  it('returns the inserted request id', async () => {
    db.run.mockResolvedValue({ lastInsertRowid: 33, changes: 1 });

    await expect(createDemoRequest('Ava Nguyen', '0900', 'ava@example.com', 'Acme')).resolves.toBe(33);
    expect(db.run).toHaveBeenCalledWith(
      'INSERT INTO demo_requests (full_name, phone, email, company_name) VALUES (?, ?, ?, ?)',
      'Ava Nguyen',
      '0900',
      'ava@example.com',
      'Acme',
    );
  });

  it('propagates insert failures', async () => {
    db.run.mockRejectedValue(new Error('write failed'));

    await expect(createDemoRequest('Ava', '0900', 'ava@example.com', 'Acme')).rejects.toThrow(
      'write failed',
    );
  });
});
