import { beforeEach, describe, expect, it, vi } from 'vitest';

const { insertAuditLog } = vi.hoisted(() => ({
  insertAuditLog: vi.fn(),
}));

vi.mock('@/lib/repositories/audit.repo', () => ({
  insertAuditLog,
}));

import { auditLog } from './audit.service';

beforeEach(() => vi.clearAllMocks());

describe('audit.service auditLog', () => {
  it('INSERTs only — delegates to insertAuditLog (D-08)', async () => {
    insertAuditLog.mockResolvedValue(undefined);
    await auditLog({
      actor_id: 1,
      company_id: 5,
      entity_type: 'user',
      entity_id: '10',
      action: 'create',
      before: null,
      after: { username: 'new' },
    });
    expect(insertAuditLog).toHaveBeenCalledWith({
      actor_id: 1,
      company_id: 5,
      entity_type: 'user',
      entity_id: '10',
      action: 'create',
      before: null,
      after: { username: 'new' },
    });
  });
});
