import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { parseRequestJson } from './parse-request-json';

describe('parseRequestJson', () => {
  it('returns parsed body on valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Acme' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await parseRequestJson(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: 'Acme' });
  });

  it('returns 400 Invalid JSON on malformed body', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: '{not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await parseRequestJson(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({ error: 'Invalid JSON' });
    }
  });
});
