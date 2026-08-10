import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, constructorMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  constructorMock: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    constructor(opts: unknown) {
      constructorMock(opts);
    }
    messages = { create: createMock };
  },
  APIConnectionTimeoutError: class APIConnectionTimeoutError extends Error {},
  AuthenticationError: class AuthenticationError extends Error {},
  APIError: class APIError extends Error {
    status?: number;
  },
}));

import { createMessage } from './client';
import { APIConnectionTimeoutError, APIError, AuthenticationError } from '@anthropic-ai/sdk';

const baseParams = {
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  messages: [{ role: 'user' as const, content: 'Generate a report' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('anthropic client', () => {
  it('returns the text on the happy path', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'Report' }] });

    await expect(createMessage({ apiKey: 'k' }, baseParams)).resolves.toEqual({ text: 'Report' });
  });

  it('throws kind validation when no text block is present (INTG-06/10)', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'thinking', thinking: '…' }] });

    await expect(createMessage({ apiKey: 'k' }, baseParams))
      .rejects.toMatchObject({ kind: 'validation', service: 'anthropic' });
  });

  it('scans content for the text block instead of assuming content[0]', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'thinking', thinking: '…' }, { type: 'text', text: 'Ok' }],
    });

    await expect(createMessage({ apiKey: 'k' }, baseParams)).resolves.toEqual({ text: 'Ok' });
  });

  it('maps APIConnectionTimeoutError to kind timeout', async () => {
    createMock.mockRejectedValue(new APIConnectionTimeoutError('timed out'));

    await expect(createMessage({ apiKey: 'k' }, baseParams))
      .rejects.toMatchObject({ kind: 'timeout', service: 'anthropic' });
  });

  it('maps AuthenticationError to kind auth', async () => {
    createMock.mockRejectedValue(new AuthenticationError('bad key'));

    await expect(createMessage({ apiKey: 'k' }, baseParams))
      .rejects.toMatchObject({ kind: 'auth', service: 'anthropic' });
  });

  it('maps APIError to kind upstream with the status', async () => {
    const err = new APIError('upstream failed');
    err.status = 429;
    createMock.mockRejectedValue(err);

    await expect(createMessage({ apiKey: 'k' }, baseParams))
      .rejects.toMatchObject({ kind: 'upstream', service: 'anthropic', status: 429 });
  });

  it('maps arbitrary errors to kind network', async () => {
    createMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(createMessage({ apiKey: 'k' }, baseParams))
      .rejects.toMatchObject({ kind: 'network', service: 'anthropic' });
  });

  it('constructs the SDK client once with a 120s timeout', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'R' }] });

    await createMessage({ apiKey: 'k' }, baseParams);

    expect(constructorMock).toHaveBeenCalledTimes(1);
    expect(constructorMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'k', timeout: 120_000 }));
  });
});
