import { describe, expect, it } from 'vitest';
import { applyProjectGovernance } from './project-governance';
import { ValidationError } from './errors';

describe('applyProjectGovernance', () => {
  it('L5 yields status Completed, RAG Not applicable, progress 100 (D-07, PROJ-05)', () => {
    const { fields, warnings } = applyProjectGovernance({ stage: 'L5' });
    expect(fields.status).toBe('Completed');
    expect(fields.rag).toBe('Not applicable');
    expect(fields.progress_pct).toBe(100);
    expect(warnings).toEqual([]);
  });

  it('L5 with client status Active returns warnings and does not throw (D-07)', () => {
    const { fields, warnings } = applyProjectGovernance({ stage: 'L5', status: 'Active' });
    expect(fields.status).toBe('Completed');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('L5 with prior progress below 100 warns and sets progress to 100 (D-07)', () => {
    const { fields, warnings } = applyProjectGovernance({ stage: 'L5' }, { progress_pct: 40 });
    expect(fields.progress_pct).toBe(100);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('status Other without status_reason throws ValidationError (D-06, PROJ-04)', () => {
    expect(() => applyProjectGovernance({ status: 'Other' })).toThrow(ValidationError);
  });

  it('weekly_report_enabled true without start period throws ValidationError (D-06, PROJ-04)', () => {
    expect(() => applyProjectGovernance({ weekly_report_enabled: true })).toThrow(ValidationError);
  });

  it('weekly_report_enabled Yes without valid period throws ValidationError (D-06)', () => {
    expect(() =>
      applyProjectGovernance({ weekly_report_enabled: 'Yes', weekly_report_start_period: 'bad' }),
    ).toThrow(ValidationError);
  });

  it('status Paused with client RAG Green defaults RAG and warns without throw (D-08, PROJ-06)', () => {
    const { fields, warnings } = applyProjectGovernance({
      status: 'Paused',
      rag: 'Green',
    });
    expect(fields.rag).toBe('Not applicable');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('progress_pct 101 throws ValidationError (PROJ-03)', () => {
    expect(() => applyProjectGovernance({ progress_pct: 101 })).toThrow(ValidationError);
  });

  it('accepts valid weekly_report_start_period when enabled (D-06)', () => {
    const { fields } = applyProjectGovernance({
      weekly_report_enabled: true,
      weekly_report_start_period: '2026-W08',
    });
    expect(fields.weekly_report_start_period).toBe('2026-W08');
  });
});
