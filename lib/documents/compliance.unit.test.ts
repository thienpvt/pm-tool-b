import { describe, expect, it } from 'vitest';
import { projectComplianceStatus } from './compliance';

describe('projectComplianceStatus', () => {
  it('returns compliant when mandatory set is empty (D-08)', () => {
    expect(projectComplianceStatus([])).toBe('compliant');
  });

  it('returns not_applicable when every mandatory item is not_applicable', () => {
    expect(
      projectComplianceStatus([
        { status: 'not_applicable' },
        { status: 'not_applicable' },
      ]),
    ).toBe('not_applicable');
  });

  it('returns not_compliant when any mandatory item is none/drafting/pending_approval', () => {
    expect(projectComplianceStatus([{ status: 'none' }])).toBe('not_compliant');
    expect(projectComplianceStatus([{ status: 'drafting' }])).toBe('not_compliant');
    expect(projectComplianceStatus([{ status: 'pending_approval' }])).toBe('not_compliant');
  });

  it('returns compliant when all mandatory items are approved', () => {
    expect(
      projectComplianceStatus([{ status: 'approved' }, { status: 'approved' }]),
    ).toBe('compliant');
  });

  it('returns compliant for mix of approved and not_applicable with at least one approved', () => {
    expect(
      projectComplianceStatus([
        { status: 'approved' },
        { status: 'not_applicable' },
      ]),
    ).toBe('compliant');
  });

  it('returns not_compliant when approved mixed with incomplete status', () => {
    expect(
      projectComplianceStatus([
        { status: 'approved' },
        { status: 'none' },
      ]),
    ).toBe('not_compliant');
  });
});
