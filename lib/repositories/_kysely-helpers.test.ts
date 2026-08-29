import { describe, expect, it } from 'vitest';
import { UnknownColumnError } from './_helpers';
import { pickAllowed } from './_kysely-helpers';

describe('pickAllowed', () => {
  const allow = ['name', 'status', 'notes'] as const;

  it('returns only allowlisted keys from the field map', () => {
    expect(pickAllowed(allow, { name: 'x' })).toEqual({ name: 'x' });
  });

  it('emits keys in allowlist order, not caller-key order', () => {
    expect(pickAllowed(allow, { notes: 'n', name: 'x' })).toEqual({ name: 'x', notes: 'n' });
  });

  it('rejects a column outside the allowlist', () => {
    expect(() => pickAllowed(allow, { company_id: 9 })).toThrow(UnknownColumnError);
  });

  it('names every unknown column, not just the first', () => {
    try {
      pickAllowed(allow, { company_id: 9, tenant: 1 });
      throw new Error('expected UnknownColumnError');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownColumnError);
      expect((e as UnknownColumnError).columns).toEqual(['company_id', 'tenant']);
    }
  });

  it('rejects rather than silently dropping when a known and unknown key are mixed', () => {
    expect(() => pickAllowed(allow, { name: 'x', company_id: 9 })).toThrow(UnknownColumnError);
  });

  it('refuses an empty field set instead of returning an empty object', () => {
    expect(() => pickAllowed(allow, {})).toThrow(UnknownColumnError);
  });

  it('keeps falsy values — an empty string is a real update', () => {
    expect(pickAllowed(allow, { notes: '' })).toEqual({ notes: '' });
  });
});
