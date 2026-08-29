import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const executeTakeFirstOrThrow = vi.fn();
  const returning = vi.fn(() => ({ executeTakeFirstOrThrow }));
  const values = vi.fn(() => ({ returning }));
  const insertInto = vi.fn(() => ({ values }));
  return { executeTakeFirstOrThrow, values, insertInto };
});

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => ({ insertInto: mocks.insertInto })),
}));

import { createDemoRequest } from './demo-requests.repo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('demo-requests.repo', () => {
  it('returns the inserted request id', async () => {
    mocks.executeTakeFirstOrThrow.mockResolvedValue({ id: 33 });

    await expect(createDemoRequest('Ava Nguyen', '0900', 'ava@example.com', 'Acme')).resolves.toBe(33);
    expect(mocks.insertInto).toHaveBeenCalledWith('demo_requests');
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Ava Nguyen',
        phone: '0900',
        email: 'ava@example.com',
        company_name: 'Acme',
      }),
    );
  });

  it('propagates insert failures', async () => {
    mocks.executeTakeFirstOrThrow.mockRejectedValue(new Error('write failed'));

    await expect(createDemoRequest('Ava', '0900', 'ava@example.com', 'Acme')).rejects.toThrow(
      'write failed',
    );
  });
});
