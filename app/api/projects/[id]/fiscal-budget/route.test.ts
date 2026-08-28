import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listFiscalBudgetsRepo,
  insertFiscalBudgetRepo,
  findFiscalBudgetByKeyRepo,
  getFiscalBudgetInProjectRepo,
  updateFiscalBudgetActualRepo,
  sumAdjustmentsVndRepo,
  listBudgetAdjustmentsRepo,
  insertBudgetAdjustmentRepo,
  auditLogFn,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listFiscalBudgetsRepo: vi.fn(),
  insertFiscalBudgetRepo: vi.fn(),
  findFiscalBudgetByKeyRepo: vi.fn(),
  getFiscalBudgetInProjectRepo: vi.fn(),
  updateFiscalBudgetActualRepo: vi.fn(),
  sumAdjustmentsVndRepo: vi.fn(),
  listBudgetAdjustmentsRepo: vi.fn(),
  insertBudgetAdjustmentRepo: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/repositories/fiscal-budget.repo', () => ({
  listFiscalBudgets: listFiscalBudgetsRepo,
  insertFiscalBudget: insertFiscalBudgetRepo,
  findFiscalBudgetByKey: findFiscalBudgetByKeyRepo,
  getFiscalBudgetInProject: getFiscalBudgetInProjectRepo,
  updateFiscalBudgetActual: updateFiscalBudgetActualRepo,
}));
vi.mock('@/lib/repositories/budget-adjustments.repo', () => ({
  sumAdjustmentsVnd: sumAdjustmentsVndRepo,
  listBudgetAdjustments: listBudgetAdjustmentsRepo,
  insertBudgetAdjustment: insertBudgetAdjustmentRepo,
}));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: auditLogFn }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, PATCH, POST } from './route';
import { POST as POST_ADJUSTMENT } from './[budgetId]/adjustments/route';
import * as adjustmentsRouteModule from './[budgetId]/adjustments/route';

const ownerSession = {
  id: 2,
  username: 'ava',
  display_name: 'Ava',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['pm'],
  status: 'active',
  email: 'ava@example.com',
};

const cpmoSession = {
  ...ownerSession,
  username: 'cpmo',
  roles: ['cpmo'],
};

const viewerSession = {
  ...ownerSession,
  username: 'viewer',
  roles: ['viewer'],
};

describe('/api/projects/[id]/fiscal-budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(true);
    sumAdjustmentsVndRepo.mockResolvedValue(0);
    listBudgetAdjustmentsRepo.mockResolvedValue([]);
    auditLogFn.mockResolvedValue(undefined);
  });

  const params = { params: Promise.resolve({ id: '7' }) };

  function req(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/fiscal-budget', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('returns 401 when session is missing', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(401);
  });

  it('GET returns 200 with metrics for PM', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listFiscalBudgetsRepo.mockResolvedValue([
      {
        id: 1,
        fiscal_year: 2026,
        cost_type: 'CAPEX',
        approved_amount_vnd: '100',
        actual_amount_vnd: '40',
      },
    ]);
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].metrics.remaining_vnd).toBe(60);
  });

  it('POST as write-access actor returns 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    findFiscalBudgetByKeyRepo.mockResolvedValue(undefined);
    insertFiscalBudgetRepo.mockResolvedValue({
      id: 3,
      fiscal_year: 2026,
      cost_type: 'OPEX',
      approved_amount_vnd: '500000',
      actual_amount_vnd: '0',
    });
    const res = await POST(
      req('POST', {
        fiscal_year: 2026,
        cost_type: 'OPEX',
        approved_amount_vnd: 500_000,
      }),
      params,
    );
    expect(res.status).toBe(201);
  });

  it('POST as viewer-only returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(
      req('POST', {
        fiscal_year: 2026,
        cost_type: 'CAPEX',
        approved_amount_vnd: 100,
      }),
      params,
    );
    expect(res.status).toBe(403);
    expect(insertFiscalBudgetRepo).not.toHaveBeenCalled();
  });

  it('PATCH actual as PM returns 200', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getFiscalBudgetInProjectRepo.mockResolvedValue({ id: 4, actual_amount_vnd: '0' });
    updateFiscalBudgetActualRepo.mockResolvedValue({ id: 4, actual_amount_vnd: '25' });
    const res = await PATCH(req('PATCH', { id: 4, actual_amount_vnd: 25 }), params);
    expect(res.status).toBe(200);
  });

  it('PATCH as viewer returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await PATCH(req('PATCH', { id: 4, actual_amount_vnd: 25 }), params);
    expect(res.status).toBe(403);
  });
});

describe('/api/projects/[id]/fiscal-budget/[budgetId]/adjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(true);
    auditLogFn.mockResolvedValue(undefined);
  });

  const adjParams = { params: Promise.resolve({ id: '7', budgetId: '5' }) };

  function adjReq(body: unknown) {
    return new NextRequest('http://localhost/api/projects/7/fiscal-budget/5/adjustments', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('POST adjustment as PM returns 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getFiscalBudgetInProjectRepo.mockResolvedValue({ id: 5, approved_amount_vnd: '1000' });
    insertBudgetAdjustmentRepo.mockResolvedValue({
      id: 12,
      fiscal_budget_id: 5,
      amount_vnd: '300',
      reason: 'Increase',
    });
    const res = await POST_ADJUSTMENT(
      adjReq({ amount_vnd: 300, effective_date: '2026-04-01', reason: 'Increase' }),
      adjParams,
    );
    expect(res.status).toBe(201);
  });

  it('POST adjustment as viewer returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST_ADJUSTMENT(
      adjReq({ amount_vnd: 300, effective_date: '2026-04-01', reason: 'Increase' }),
      adjParams,
    );
    expect(res.status).toBe(403);
    expect(insertBudgetAdjustmentRepo).not.toHaveBeenCalled();
  });

  it('GET fiscal-budget lists adjustments on the row', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listFiscalBudgetsRepo.mockResolvedValue([
      {
        id: 5,
        fiscal_year: 2026,
        cost_type: 'CAPEX',
        approved_amount_vnd: '1000',
        actual_amount_vnd: '0',
      },
    ]);
    listBudgetAdjustmentsRepo.mockResolvedValue([
      { id: 1, amount_vnd: '200', reason: 'Increase' },
    ]);
    sumAdjustmentsVndRepo.mockResolvedValue(200);
    const getReq = new NextRequest('http://localhost/api/projects/7/fiscal-budget', {
      method: 'GET',
    });
    const res = await GET(getReq, { params: Promise.resolve({ id: '7' }) });
    const body = await res.json();
    expect(body[0].adjustments).toHaveLength(1);
    expect(body[0].metrics.approved_net_vnd).toBe(1200);
  });

  it('does not export PATCH or DELETE on adjustments route', () => {
    expect(adjustmentsRouteModule.PATCH).toBeUndefined();
    expect(adjustmentsRouteModule.DELETE).toBeUndefined();
  });
});
