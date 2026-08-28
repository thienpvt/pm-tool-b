import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exportPortfolioDashboard } = vi.hoisted(() => ({
  exportPortfolioDashboard: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/dashboards/backend/services/spec-dashboards.service', () => ({ exportPortfolioDashboard }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

const cpmoSession = {
  id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['cpmo'] as const,
  status: 'active' as const,
  email: 'cpmo@acme.com',
};

const pmSession = {
  ...cpmoSession,
  id: 2,
  username: 'pm',
  roles: ['pm'] as const,
};

const viewerSession = {
  ...cpmoSession,
  id: 3,
  username: 'viewer',
  roles: ['viewer'] as const,
};

const nullCompanyAdminSession = {
  id: 99,
  username: 'admin',
  display_name: 'Admin',
  company_id: null,
  company_name: null,
  is_admin: 1,
  onboarding_completed: 1,
  roles: [] as const,
  status: 'active' as const,
  email: 'admin@example.com',
};

function jsonReq(body: unknown, url = 'http://localhost/api/dashboards/portfolio/export') {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('POST /api/dashboards/portfolio/export', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq({ format: 'xlsx' }), ctx);
    expect(res.status).toBe(401);
    expect(exportPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(jsonReq({ format: 'xlsx' }), ctx);
    expect(res.status).toBe(403);
    expect(exportPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(jsonReq({ format: 'pdf' }), ctx);
    expect(res.status).toBe(403);
    expect(exportPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for null-company admin session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyAdminSession as never);
    const res = await POST(jsonReq({ format: 'xlsx' }), ctx);
    expect(res.status).toBe(403);
    expect(exportPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid format (D-08)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    const res = await POST(jsonReq({ format: 'docx' }), ctx);
    expect(res.status).toBe(400);
    expect(exportPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 200 with xlsx Content-Type and attachment for cpmo (D-08)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    exportPortfolioDashboard.mockResolvedValue({
      buffer: Buffer.from('xlsx-bytes'),
      filename: 'portfolio-dashboard.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const res = await POST(jsonReq({ format: 'xlsx' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('portfolio-dashboard.xlsx');
    expect(exportPortfolioDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
      { format: 'xlsx' },
    );
  });

  it('returns 200 with pdf Content-Type and attachment for cpmo (D-08)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    exportPortfolioDashboard.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4'),
      filename: 'portfolio-dashboard.pdf',
      contentType: 'application/pdf',
    });

    const res = await POST(jsonReq({ format: 'pdf' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('portfolio-dashboard.pdf');
  });
});
