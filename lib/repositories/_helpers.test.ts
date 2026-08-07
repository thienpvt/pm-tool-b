import { describe, expect, it } from 'vitest';
import { buildUpdate, UnknownColumnError } from './_helpers';

describe('buildUpdate', () => {
  const allow = ['name', 'status', 'notes'] as const;

  it('builds a SET fragment with ? placeholders', () => {
    expect(buildUpdate('projects', allow, { name: 'x' })).toEqual({ sql: 'name = ?', values: ['x'] });
  });

  it('emits columns in allowlist order, not caller-key order', () => {
    const { sql, values } = buildUpdate('projects', allow, { notes: 'n', name: 'x' });
    expect(sql).toBe('name = ?, notes = ?');
    expect(values).toEqual(['x', 'n']);
  });

  it('rejects a column outside the allowlist', () => {
    expect(() => buildUpdate('projects', allow, { company_id: 9 })).toThrow(UnknownColumnError);
  });

  it('names every unknown column, not just the first', () => {
    try {
      buildUpdate('projects', allow, { company_id: 9, tenant: 1 });
      throw new Error('expected UnknownColumnError');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownColumnError);
      expect((e as UnknownColumnError).columns).toEqual(['company_id', 'tenant']);
    }
  });

  it('rejects rather than silently dropping when a known and unknown key are mixed', () => {
    expect(() => buildUpdate('projects', allow, { name: 'x', company_id: 9 })).toThrow(UnknownColumnError);
  });

  it('refuses an empty field set instead of emitting an empty SET clause', () => {
    expect(() => buildUpdate('projects', allow, {})).toThrow(UnknownColumnError);
  });

  it('keeps falsy values — an empty string is a real update', () => {
    expect(buildUpdate('projects', allow, { notes: '' })).toEqual({ sql: 'notes = ?', values: [''] });
  });
});
