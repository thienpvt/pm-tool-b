export type ComplianceStatus = 'compliant' | 'not_compliant' | 'not_applicable';

const COMPLETE_STATUSES = new Set(['approved', 'not_applicable']);

/**
 * Project-level compliance rollup from mandatory checklist items only (D-08, D-10).
 * Callers must filter to mandatory catalog rows before invoking.
 */
export function projectComplianceStatus(
  mandatoryItems: Array<{ status: string }>,
): ComplianceStatus {
  if (mandatoryItems.length === 0) return 'compliant';

  const allNotApplicable = mandatoryItems.every((item) => item.status === 'not_applicable');
  if (allNotApplicable) return 'not_applicable';

  const anyIncomplete = mandatoryItems.some((item) => !COMPLETE_STATUSES.has(item.status));
  if (anyIncomplete) return 'not_compliant';

  return 'compliant';
}
