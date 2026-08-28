import { beforeEach, describe, expect, it, vi } from 'vitest';

const { insertAuditLog, listAuditLogsRepo } = vi.hoisted(() => ({
  insertAuditLog: vi.fn(),
  listAuditLogsRepo: vi.fn(),
}));

vi.mock('@/lib/repositories/audit.repo', () => ({
  insertAuditLog,
  listAuditLogs: listAuditLogsRepo,
}));

import type { AccessActor } from './access';
import { auditLog, listAuditLogs } from './audit.service';
import { ForbiddenError, ValidationError } from './errors';

const cpmoActor: AccessActor = {
  company_id: 5,
  is_admin: 0,
  roles: ['cpmo'],
  status: 'active',
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@example.com',
};

const nullCompanyCpmo: AccessActor = {
  ...cpmoActor,
  company_id: null,
};

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

describe('audit.service listAuditLogs', () => {
  it('calls assertCompanyWrite then repo with actor.company_id (D-05, D-06)', async () => {
    listAuditLogsRepo.mockResolvedValue([]);
    await listAuditLogs(cpmoActor);
    expect(listAuditLogsRepo).toHaveBeenCalledWith(5, expect.objectContaining({ limit: 50 }));
  });

  it('throws ForbiddenError when company_id is null and does not call repo (D-05)', async () => {
    await expect(listAuditLogs(nullCompanyCpmo)).rejects.toThrow(ForbiddenError);
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });

  it('defaults limit to 50 when omitted (D-06)', async () => {
    listAuditLogsRepo.mockResolvedValue([]);
    await listAuditLogs(cpmoActor);
    expect(listAuditLogsRepo).toHaveBeenCalledWith(5, expect.objectContaining({ limit: 50 }));
  });

  it('caps limit at 200 (D-06)', async () => {
    listAuditLogsRepo.mockResolvedValue([]);
    await listAuditLogs(cpmoActor, { limit: 201 });
    expect(listAuditLogsRepo).toHaveBeenCalledWith(5, expect.objectContaining({ limit: 200 }));
  });

  it('passes limit 1 unchanged (D-06)', async () => {
    listAuditLogsRepo.mockResolvedValue([]);
    await listAuditLogs(cpmoActor, { limit: 1 });
    expect(listAuditLogsRepo).toHaveBeenCalledWith(5, expect.objectContaining({ limit: 1 }));
  });

  it('throws ValidationError for invalid from date and does not call repo (D-06)', async () => {
    await expect(listAuditLogs(cpmoActor, { from: 'not-a-date' })).rejects.toThrow(ValidationError);
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });

  it('throws ValidationError for invalid to date and does not call repo (D-06)', async () => {
    await expect(listAuditLogs(cpmoActor, { to: '2026/01/01' })).rejects.toThrow(ValidationError);
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });
});
