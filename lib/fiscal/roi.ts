export type RoiResult = { status: 'insufficient' } | { status: 'ok'; percent: number };

/** Expected ROI% when approved_net > 0 and at least one benefit row exists (D-08). */
export function computeExpectedRoi(
  sumExpectedBenefitsVnd: number,
  approvedNetVnd: number,
  hasExpectedRow: boolean,
): RoiResult {
  if (!hasExpectedRow || approvedNetVnd <= 0) {
    return { status: 'insufficient' };
  }
  const percent = ((sumExpectedBenefitsVnd - approvedNetVnd) / approvedNetVnd) * 100;
  return { status: 'ok', percent };
}

/** Actual ROI% only when spend > 0, every benefit row has actual_vnd, and rows exist (D-08). */
export function computeActualRoi(
  sumActualBenefitsVnd: number,
  actualSpendVnd: number,
  allActualsPresent: boolean,
  hasBenefitRow: boolean,
): RoiResult {
  if (!hasBenefitRow || !allActualsPresent || actualSpendVnd <= 0) {
    return { status: 'insufficient' };
  }
  const percent = ((sumActualBenefitsVnd - actualSpendVnd) / actualSpendVnd) * 100;
  return { status: 'ok', percent };
}
