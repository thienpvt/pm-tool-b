import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listIncidentsForSystem, createIncidentForSystem } = vi.hoisted(() => ({
  listIncidentsForSystem: vi.fn(),
  createIncidentForSystem: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/operations.service', () => ({
  listIncidentsForSystem,
  createIncidentForSystem,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

const session = {
  id: 1,
  username: 'ops',
  display_name: 'Ops User',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: [] as const,
  status: 'active' as const,
  email: 'ops@acme.com',
};

function jsonReq(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/operations/systems/42/incidents', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

const ctx = { params: Promise.resolve({ id: '42' }) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/operations/systems/[id]/incidents', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(listIncidentsForSystem).not.toHaveBeenCalled();
  });

  it('returns 404 when service returns null', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    listIncidentsForSystem.mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(listIncidentsForSystem).toHaveBeenCalledWith(session, '42');
  });
});

describe('POST /api/operations/systems/[id]/incidents', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq('POST', { title: 'Outage' }), ctx);
    expect(res.status).toBe(401);
    expect(createIncidentForSystem).not.toHaveBeenCalled();
  });
});
