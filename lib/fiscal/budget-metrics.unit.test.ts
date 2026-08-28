import { describe, expect, it } from 'vitest';
import { computeFiscalBudgetMetrics } from './budget-metrics';

describe('computeFiscalBudgetMetrics', () => {
  it('(100, 0, 40) remaining 60 utilization 0.4 status ok', () => {
    const m = computeFiscalBudgetMetrics(100, 0, 40);
    expect(m.approved_net_vnd).toBe(100);
    expect(m.remaining_vnd).toBe(60);
    expect(m.utilization).toBe(0.4);
    expect(m.status).toBe('ok');
  });

  it('(100, 0, 100) fully_used', () => {
    const m = computeFiscalBudgetMetrics(100, 0, 100);
    expect(m.status).toBe('fully_used');
    expect(m.remaining_vnd).toBe(0);
  });

  it('(100, 0, 150) over_budget', () => {
    const m = computeFiscalBudgetMetrics(100, 0, 150);
    expect(m.status).toBe('over_budget');
    expect(m.remaining_vnd).toBe(-50);
  });

  it('(0, 0, 0) insufficient utilization null', () => {
    const m = computeFiscalBudgetMetrics(0, 0, 0);
    expect(m.status).toBe('insufficient');
    expect(m.utilization).toBeNull();
  });
});
