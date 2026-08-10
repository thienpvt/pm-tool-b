import { afterEach, describe, expect, it, vi } from 'vitest';
import { integrationErrorResponse } from './api-errors';
import { IntegrationError } from './integrations/errors';

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
