import { describe, expect, it } from 'vitest';
import { parseHttpsUrl } from './https-url';
import {
  assertChecklistPatchRules,
  rejectBinaryFields,
  CHECKLIST_STATUSES,
} from './checklist-status';
import { ValidationError } from '@/lib/services/errors';

describe('parseHttpsUrl (D-07)', () => {
  it('returns trimmed https URL on success', () => {
    expect(parseHttpsUrl('  https://confluence.example.com/page  ', 'confluence_url')).toBe(
      'https://confluence.example.com/page',
    );
  });

  it('throws ValidationError for empty value when allowEmpty is false', () => {
    expect(() => parseHttpsUrl('', 'template_url')).toThrow(ValidationError);
    expect(() => parseHttpsUrl(null, 'template_url')).toThrow(ValidationError);
    expect(() => parseHttpsUrl(undefined, 'template_url')).toThrow(ValidationError);
  });

  it('returns null for empty value when allowEmpty is true', () => {
    expect(parseHttpsUrl('', 'confluence_url', { allowEmpty: true })).toBeNull();
    expect(parseHttpsUrl(null, 'confluence_url', { allowEmpty: true })).toBeNull();
  });

  it('throws ValidationError for non-https protocol', () => {
    expect(() => parseHttpsUrl('http://example.com', 'confluence_url')).toThrow(ValidationError);
    expect(() => parseHttpsUrl('ftp://example.com', 'confluence_url')).toThrow(ValidationError);
  });

  it('throws ValidationError for data: prefix', () => {
    expect(() =>
      parseHttpsUrl('data:text/plain;base64,abc', 'confluence_url'),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for non-string', () => {
    expect(() => parseHttpsUrl(123, 'confluence_url')).toThrow(ValidationError);
  });
});

describe('rejectBinaryFields (D-07)', () => {
  it('throws when body includes binary field keys', () => {
    for (const key of ['file', 'content', 'blob', 'attachment', 'data']) {
      expect(() => rejectBinaryFields({ [key]: 'x' })).toThrow(ValidationError);
    }
  });

  it('allows bodies without binary keys', () => {
    expect(() => rejectBinaryFields({ status: 'none' })).not.toThrow();
  });
});

describe('assertChecklistPatchRules (D-07, D-08)', () => {
  it('exports expected statuses', () => {
    expect(CHECKLIST_STATUSES).toEqual([
      'none',
      'drafting',
      'pending_approval',
      'approved',
      'not_applicable',
    ]);
  });

  it('approved requires approved_at and approved_by', () => {
    expect(() =>
      assertChecklistPatchRules(
        { approved_at: '2026-01-01' },
        'approved',
      ),
    ).toThrow(ValidationError);
    expect(() =>
      assertChecklistPatchRules(
        { approved_by: 'Jane', confluence_url: 'https://conf.example.com/x' },
        'approved',
      ),
    ).toThrow(ValidationError);
    expect(() =>
      assertChecklistPatchRules(
        {
          approved_at: '2026-01-01',
          approved_by: 'Jane',
          confluence_url: 'https://conf.example.com/x',
        },
        'approved',
      ),
    ).not.toThrow();
  });

  it('not_applicable requires na_reason', () => {
    expect(() => assertChecklistPatchRules({}, 'not_applicable')).toThrow(ValidationError);
    expect(() =>
      assertChecklistPatchRules({ na_reason: 'Not required for pilot' }, 'not_applicable'),
    ).not.toThrow();
  });

  it('rejects http and data-url confluence_url', () => {
    expect(() =>
      assertChecklistPatchRules({ confluence_url: 'http://bad.example.com' }, 'pending_approval'),
    ).toThrow(ValidationError);
    expect(() =>
      assertChecklistPatchRules(
        { confluence_url: 'data:text/plain;base64,x' },
        'pending_approval',
      ),
    ).toThrow(ValidationError);
  });

  it('allows empty confluence_url for none and drafting only', () => {
    expect(() => assertChecklistPatchRules({}, 'none')).not.toThrow();
    expect(() => assertChecklistPatchRules({}, 'drafting')).not.toThrow();
    expect(() => assertChecklistPatchRules({}, 'pending_approval')).toThrow(ValidationError);
    expect(() => assertChecklistPatchRules({}, 'approved')).toThrow(ValidationError);
  });

  it('throws for unknown status', () => {
    expect(() => assertChecklistPatchRules({}, 'invalid')).toThrow(ValidationError);
  });
});
