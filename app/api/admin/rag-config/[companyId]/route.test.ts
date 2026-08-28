import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RAG_CONFIG } from '@/lib/rag';

const { getCompanyRagConfigOrDefault, getSessionFromRequest } = vi.hoisted(() => ({
  getCompanyRagConfigOrDefault: vi.fn(),
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  forbidden: vi.fn(),
  getSessionFromRequest,
  unauthorized: vi.fn(),
}));
vi.mock('@/lib/services/rag-config.service', () => ({
  getCompanyRagConfigOrDefault,
  setCompanyRagConfigValues: vi.fn(),
}));

import { GET } from './route';

const configKeys = Object.keys(DEFAULT_RAG_CONFIG).sort();

describe('GET /api/admin/rag-config/[companyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionFromRequest.mockResolvedValue({ is_admin: 1 });
  });

  async function responseBody() {
    const request = new NextRequest('http://localhost/api/admin/rag-config/12');
    const response = await GET(request, { params: Promise.resolve({ companyId: '12' }) });
    expect(response.status).toBe(200);
    return response.json();
  }

  it('returns the stable eight-field shape for a stored config', async () => {
    getCompanyRagConfigOrDefault.mockResolvedValue({
      ...DEFAULT_RAG_CONFIG,
      spi_red_threshold: 0.42,
    });

    const body = await responseBody();

    expect(Object.keys(body).sort()).toEqual(configKeys);
    expect(body.spi_red_threshold).toBe(0.42);
    expect(body).not.toHaveProperty('company_id');
    expect(body).not.toHaveProperty('updated_at');
  });

  it('returns the same shape when falling back to defaults', async () => {
    getCompanyRagConfigOrDefault.mockResolvedValue(DEFAULT_RAG_CONFIG);

    const body = await responseBody();

    expect(body).toEqual(DEFAULT_RAG_CONFIG);
    expect(Object.keys(body).sort()).toEqual(configKeys);
  });
});
