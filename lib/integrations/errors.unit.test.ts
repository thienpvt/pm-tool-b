import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError, withFetchTimeout } from './errors';

const NEVER = () => new Promise(() => {});

describe('IntegrationError', () => {
  it('carries name, kind, service, optional status and cause', () => {
    const cause = new Error('upstream 500');
    const err = new IntegrationError({ kind: 'upstream', service: 'jira', status: 500, cause });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('IntegrationError');
    expect(err.kind).toBe('upstream');
    expect(err.service).toBe('jira');
    expect(err.status).toBe(500);
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('IntegrationError[jira:upstream]');
  });

  it('defaults the message and omits status when not supplied', () => {
    const err = new IntegrationError({ kind: 'timeout', service: 'resend' });
    expect(err.message).toBe('IntegrationError[resend:timeout]');
    expect(err.status).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });
});

describe('withFetchTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps a timeout to kind "timeout"', async () => {
    vi.useFakeTimers();
    const pending = withFetchTimeout(NEVER(), 10);
    await vi.advanceTimersByTimeAsync(10);
    const result = await pending;
    expect(result.value).toBeNull();
    expect(result.error?.kind).toBe('timeout');
  });

  it('returns the value and clears the timer on success', async () => {
    const result = await withFetchTimeout(Promise.resolve(42), 10);
    expect(result).toEqual({ value: 42, error: null });
  });

  it('maps a rejected promise to kind "network"', async () => {
    const result = await withFetchTimeout(Promise.reject(new Error('boom')), 10);
    expect(result.value).toBeNull();
    expect(result.error?.kind).toBe('network');
  });

  it('maps a caller abort to kind "network", never "timeout"', async () => {
    const caller = new AbortController();
    caller.abort();
    const result = await withFetchTimeout(NEVER(), 10, caller.signal);
    expect(result.value).toBeNull();
    expect(result.error?.kind).toBe('network');
  });
});
