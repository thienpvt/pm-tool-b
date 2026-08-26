import { describe, expect, it } from 'vitest';
import { computeActualRoi, computeExpectedRoi } from './roi';

describe('computeExpectedRoi', () => {
  it('returns insufficient when no benefit rows', () => {
    expect(computeExpectedRoi(100, 1000, false)).toEqual({ status: 'insufficient' });
  });

  it('returns insufficient when approved_net is zero', () => {
    expect(computeExpectedRoi(100, 0, true)).toEqual({ status: 'insufficient' });
  });

  it('returns insufficient when approved_net is negative', () => {
    expect(computeExpectedRoi(100, -50, true)).toEqual({ status: 'insufficient' });
  });

  it('returns ok percent when inputs complete and equal yields zero percent', () => {
    expect(computeExpectedRoi(1000, 1000, true)).toEqual({ status: 'ok', percent: 0 });
  });

  it('returns ok positive percent when benefits exceed approved_net', () => {
    expect(computeExpectedRoi(1500, 1000, true)).toEqual({ status: 'ok', percent: 50 });
  });
});

describe('computeActualRoi', () => {
  it('returns insufficient when no benefit rows', () => {
    expect(computeActualRoi(100, 1000, true, false)).toEqual({ status: 'insufficient' });
  });

  it('returns insufficient when any actual is missing', () => {
    expect(computeActualRoi(100, 1000, false, true)).toEqual({ status: 'insufficient' });
  });

  it('returns insufficient when actual spend is zero', () => {
    expect(computeActualRoi(100, 0, true, true)).toEqual({ status: 'insufficient' });
  });

  it('returns ok zero percent when complete inputs equal spend', () => {
    expect(computeActualRoi(500, 500, true, true)).toEqual({ status: 'ok', percent: 0 });
  });

  it('returns ok positive percent when actual benefits exceed spend', () => {
    expect(computeActualRoi(1200, 1000, true, true)).toEqual({ status: 'ok', percent: 20 });
  });
});
