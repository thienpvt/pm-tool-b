import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/lib/integrations/errors';

/**
 * SVC-05 companion / T-04-18: an IntegrationError raised beneath a service
 * must reach the route with kind and service intact. Services must NOT
 * catch-and-rewrap IntegrationError (Phase 3 freeze).
 *
 * The weekly report service does not call Anthropic itself (POST stays in the
 * route), so we simulate the contract by asserting that an IntegrationError
 * thrown from a repository dependency propagates out of the service unchanged.
 */

const {
  assertProjectAccess,
  getProjectWithCustomer,
  listDoneBetween,
  listByStatuses,
  listPlannedBetweenExcludingStatuses,
  listStatusAndPhase,
  listOpenRisks,
  listOpenIssues,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  getProjectWithCustomer: vi.fn(),
  listDoneBetween: vi.fn(),
  listByStatuses: vi.fn(),
  listPlannedBetweenExcludingStatuses: vi.fn(),
  listStatusAndPhase: vi.fn(),
  listOpenRisks: vi.fn(),
  listOpenIssues: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({
  getProjectWithCustomer,
  getProjectForReport: vi.fn(),
}));
vi.mock('@/modules/projects/backend/repositories/activities.repo', () => ({
  listDoneBetween,
  listByStatuses,
  listPlannedBetweenExcludingStatuses,
  listStatusAndPhase,
  listForProjectReport: vi.fn(),
}));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({
  listOpenRisks,
  listNotClosedByPriority: vi.fn(),
}));
vi.mock('@/modules/projects/backend/repositories/issues.repo', () => ({
  listOpenIssues,
  listNotClosedByPriority: vi.fn(),
}));
vi.mock('@/modules/projects/backend/repositories/milestones.repo', () => ({
  listMilestones: vi.fn(),
  listEpicActivityIds: vi.fn(),
}));
vi.mock('@/modules/projects/backend/repositories/bugs.repo', () => ({
  maxSnapshotDate: vi.fn(),
  snapshotDateOnOrBefore: vi.fn(),
  countsBySnapshot: vi.fn(),
}));
vi.mock('@/modules/projects/backend/repositories/team.repo', () => ({ listForReport: vi.fn() }));
vi.mock('@/modules/admin/backend/repositories/rag-config.repo', () => ({ companyRagConfig: vi.fn() }));

import { getWeeklyProjectReport } from '@/modules/reports/backend/services/project-report.service';
import { integrationErrorResponse } from '@/lib/api-errors';

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  getProjectWithCustomer.mockResolvedValue({ id: 7, name: 'P', company_id: 5, current_phase: 'Execution' });
  listDoneBetween.mockResolvedValue([]);
  listByStatuses.mockResolvedValue([]);
  listPlannedBetweenExcludingStatuses.mockResolvedValue([]);
  listOpenRisks.mockResolvedValue([]);
  listOpenIssues.mockResolvedValue([]);
});

describe('IntegrationError passthrough (Phase 3 freeze)', () => {
  it('propagates IntegrationError with kind and service intact', async () => {
    const err = new IntegrationError({
      kind: 'upstream',
      service: 'anthropic',
      status: 529,
      message: 'overloaded',
    });
    listStatusAndPhase.mockRejectedValue(err);

    let caught: unknown;
    try {
      await getWeeklyProjectReport(7, owner, { start: '2026-06-01', end: '2026-06-07' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(err); // same instance, not rewrapped
    expect(caught).toBeInstanceOf(IntegrationError);
    const ie = caught as IntegrationError;
    expect(ie.kind).toBe('upstream');
    expect(ie.service).toBe('anthropic');
    expect(ie.status).toBe(529);
  });

  it('maps a passthrough IntegrationError via integrationErrorResponse with force500', async () => {
    const err = new IntegrationError({
      kind: 'timeout',
      service: 'anthropic',
      message: 'timed out',
    });
    listStatusAndPhase.mockRejectedValue(err);

    try {
      await getWeeklyProjectReport(7, owner, { start: '2026-06-01', end: '2026-06-07' });
      expect.unreachable('should have thrown');
    } catch (e) {
      // Route catch chain: IntegrationError → integrationErrorResponse(..., { force500: true })
      const res = integrationErrorResponse(e, { force500: true });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('timed out');
    }
  });
});
