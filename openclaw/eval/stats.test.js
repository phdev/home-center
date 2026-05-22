import { describe, expect, it } from 'vitest';
import { summarize, wilsonInterval } from './stats.js';

function expectCloseArray(actual, expected, precision = 3) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index], precision);
  });
}

describe('summarize', () => {
  it('returns finite zeros for empty samples', () => {
    expect(summarize([])).toEqual({
      n: 0,
      mean: 0,
      stdev: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      max: 0,
      min: 0,
    });
  });

  it('returns finite single-sample stats with stdev zero', () => {
    expect(summarize([42])).toEqual({
      n: 1,
      mean: 42,
      stdev: 0,
      p50: 42,
      p90: 42,
      p95: 42,
      max: 42,
      min: 42,
    });
  });

  it('uses unbiased stdev and interpolated quantiles for two samples', () => {
    const stats = summarize([10, 20]);
    expect(stats.n).toBe(2);
    expect(stats.mean).toBe(15);
    expect(stats.stdev).toBeCloseTo(Math.sqrt(50), 8);
    expect(stats.p50).toBe(15);
    expect(stats.p90).toBe(19);
    expect(stats.p95).toBe(19.5);
    expect(stats.max).toBe(20);
    expect(stats.min).toBe(10);
  });
});

describe('wilsonInterval', () => {
  it('returns [0, 1] when no trials exist', () => {
    expect(wilsonInterval(0, 0)).toEqual([0, 1]);
  });

  it('computes Wilson intervals for representative pass counts', () => {
    expectCloseArray(wilsonInterval(1, 1), [0.2065, 1], 3);
    expectCloseArray(wilsonInterval(10, 12), [0.5519, 0.9530], 3);
    expectCloseArray(wilsonInterval(0, 5), [0, 0.4345], 3);
    expectCloseArray(wilsonInterval(12, 12), [0.7575, 1], 3);
  });
});
