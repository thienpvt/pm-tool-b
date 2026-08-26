export type FiscalBudgetMetrics = {
  approved_net_vnd: number;
  actual_amount_vnd: number;
  remaining_vnd: number;
  utilization: number | null;
  status: 'ok' | 'over_budget' | 'fully_used' | 'insufficient';
};

/** Computed remaining/utilization/status — not stored columns (D-03, D-16). */
export function computeFiscalBudgetMetrics(
  approvedBaseline: number,
  adjustmentSum: number,
  actual: number,
): FiscalBudgetMetrics {
  const approved_net_vnd = approvedBaseline + adjustmentSum;
  const actual_amount_vnd = actual;
  const remaining_vnd = approved_net_vnd - actual;

  if (approved_net_vnd <= 0) {
    return {
      approved_net_vnd,
      actual_amount_vnd,
      remaining_vnd,
      utilization: null,
      status: 'insufficient',
    };
  }

  const utilization = actual / approved_net_vnd;
  let status: FiscalBudgetMetrics['status'] = 'ok';
  if (remaining_vnd < 0) status = 'over_budget';
  else if (remaining_vnd === 0) status = 'fully_used';

  return { approved_net_vnd, actual_amount_vnd, remaining_vnd, utilization, status };
}
