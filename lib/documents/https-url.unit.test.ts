import { describe, expect, it } from 'vitest';
import { parseHttpsUrl } from './https-url';
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
