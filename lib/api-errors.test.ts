import { afterEach, describe, expect, it, vi } from 'vitest';
import { integrationErrorResponse, serviceErrorResponse } from './api-errors';
import { IntegrationError } from './integrations/errors';
import {
  ForbiddenError,
  NotFoundError,
  SubmitValidationError,
  ValidationError,
} from './services/errors';

/**
 * INTG-06: a malformed upstream response must log server-side and must not
 * surface as a 500. The `cause` (raw zod error) must never cross to the client.
 */

const validationError = (service: string) =>
  new IntegrationError({ kind: 'validation', service, cause: { issues: ['expected string, got number'] } });

afterEach(() => vi.restoreAllMocks());

describe('integrationErrorResponse — validation branches', () => {
  for (const service of ['jira', 'resend', 'anthropic'] as const) {
    it(`${service}: logs the cause and returns 502, never the schema detail`, async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = integrationErrorResponse(validationError(service));
      const body = await res.json();

      expect(res.status).toBe(502);
      expect(logged).toHaveBeenCalledOnce();
      expect(logged.mock.calls[0][1]).toMatchObject({ service });
      expect(JSON.stringify(body)).not.toContain('expected string, got number');
    });
  }

  it('anthropic: validation escapes force500 — a shape mismatch is 502 even on the report routes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = integrationErrorResponse(validationError('anthropic'), { force500: true });

    expect(res.status).toBe(502);
  });

  it('anthropic: force500 still governs the frozen non-validation kinds', async () => {
    const upstream = new IntegrationError({ kind: 'upstream', service: 'anthropic', status: 429 });

    expect(integrationErrorResponse(upstream, { force500: true }).status).toBe(500);
    expect(integrationErrorResponse(upstream).status).toBe(502);
  });
});

describe('serviceErrorResponse', () => {
  it('maps ForbiddenError to 403 without leaking the message', async () => {
    const res = serviceErrorResponse(new ForbiddenError('you cannot see project 42'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(JSON.stringify(body)).not.toContain('project 42');
    expect(JSON.stringify(body)).not.toContain('you cannot see');
  });

  it('maps NotFoundError to 404', async () => {
    const res = serviceErrorResponse(new NotFoundError('missing', 'project'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Not found' });
  });

  it('maps ValidationError to 400 with optional field', async () => {
    const res = serviceErrorResponse(new ValidationError('bad category', 'category'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'bad category', field: 'category' });
  });

  it('maps SubmitValidationError to 400 with fields array not singular field (D-11, RAID-03)', async () => {
    const res = serviceErrorResponse(
      new SubmitValidationError('fix fields', ['raid.risks[0].description']),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: 'fix fields',
      fields: ['raid.risks[0].description'],
    });
    expect(body).not.toHaveProperty('field');
  });

  it('maps unknown errors to a generic 500 without String(e)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'SQLSTATE detail: relation "secrets" does not exist';

    const res = serviceErrorResponse(new Error(secret));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(JSON.stringify(body)).not.toContain('SQLSTATE');
    expect(logged).toHaveBeenCalled();
  });

  it('does not classify IntegrationError — falls through to generic 500', async () => {
    // Documents the boundary: IntegrationError is re-thrown by services and
    // handled by integrationErrorResponse in the route catch chain, not here.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new IntegrationError({ kind: 'upstream', service: 'jira', status: 429, message: 'rate limited' });

    const res = serviceErrorResponse(err);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
