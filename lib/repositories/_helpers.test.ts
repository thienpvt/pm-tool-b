import { describe, expect, it } from 'vitest';
import { UnknownColumnError } from './_helpers';

describe('UnknownColumnError', () => {
  it('lists every unknown column in the message', () => {
    const err = new UnknownColumnError(['company_id', 'tenant']);
    expect(err.message).toBe('Unknown column(s): company_id, tenant');
    expect(err.columns).toEqual(['company_id', 'tenant']);
    expect(err.name).toBe('UnknownColumnError');
  });

  it('uses a dedicated message when no updatable columns remain', () => {
    const err = new UnknownColumnError([]);
    expect(err.message).toBe('No updatable columns provided');
    expect(err.columns).toEqual([]);
  });
});
