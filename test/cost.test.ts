import { describe, expect, it } from 'vitest';

import {
  addRecord,
  anthropicPricing,
  calculateCost,
  createCostRecord,
  createTracker,
  isNearBudget,
  isOverBudget,
  totalCost,
} from '../src/index.js';
import type { PricingTable } from '../src/index.js';

const PRICING: PricingTable = {
  models: { 'model-a': { input: 3.0, output: 15.0 } },
  fallback: { input: 3.0, output: 15.0 },
};

describe('calculateCost', () => {
  it('5. computes base input/output cost for a known model', () => {
    const c = calculateCost(PRICING, 'model-a', { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(c.inputCost).toBeCloseTo(3.0);
    expect(c.outputCost).toBeCloseTo(15.0);
    expect(c.totalCost).toBeCloseTo(18.0);
  });

  it('6. bills cache reads at the 0.10x default multiplier', () => {
    const c = calculateCost(PRICING, 'model-a', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
    });
    expect(c.cacheReadCost).toBeCloseTo(0.3); // 3.0 * 0.10
  });

  it('7. bills cache writes at the 1.25x default multiplier', () => {
    const c = calculateCost(PRICING, 'model-a', {
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 1_000_000,
    });
    expect(c.cacheWriteCost).toBeCloseTo(3.75); // 3.0 * 1.25
  });

  it('8. sums every component into totalCost', () => {
    const c = calculateCost(PRICING, 'model-a', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(c.totalCost).toBeCloseTo(c.inputCost + c.outputCost + c.cacheReadCost + c.cacheWriteCost);
    expect(c.totalCost).toBeCloseTo(18 + 0.3 + 3.75);
  });

  it('9. uses fallback pricing for an unknown model', () => {
    const pricing: PricingTable = {
      models: {},
      fallback: { input: 2.0, output: 4.0 },
    };
    const c = calculateCost(pricing, 'who-dis', { inputTokens: 1_000_000, outputTokens: 0 });
    expect(c.inputCost).toBeCloseTo(2.0);
  });

  it('10. honors custom cache multipliers', () => {
    const pricing: PricingTable = {
      ...PRICING,
      cacheReadMultiplier: 0.5,
      cacheWriteMultiplier: 2,
    };
    const c = calculateCost(pricing, 'model-a', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(c.cacheReadCost).toBeCloseTo(1.5); // 3.0 * 0.5
    expect(c.cacheWriteCost).toBeCloseTo(6.0); // 3.0 * 2
  });

  it('exposes a usable Anthropic pricing preset', () => {
    const c = calculateCost(anthropicPricing, 'claude-haiku-4-5', {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(c.inputCost).toBeCloseTo(1.0);
  });
});

describe('cost tracker', () => {
  const record = (costOverride: number) =>
    ({
      model: 'model-a',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: costOverride,
      feature: 'test',
      timestamp: 0,
    }) as const;

  it('11. addRecord returns a new tracker and does not mutate the original', () => {
    const t0 = createTracker();
    const t1 = addRecord(t0, record(1));
    expect(t0.records).toHaveLength(0);
    expect(t1.records).toHaveLength(1);
    expect(t1).not.toBe(t0);
  });

  it('createCostRecord derives costUsd from the pricing table', () => {
    const r = createCostRecord(PRICING, 'model-a', { inputTokens: 1_000_000, outputTokens: 0 }, 'router');
    expect(r.costUsd).toBeCloseTo(3.0);
    expect(r.feature).toBe('router');
  });

  it('12. totalCost sums all records', () => {
    let t = createTracker();
    t = addRecord(t, record(1.5));
    t = addRecord(t, record(2.25));
    expect(totalCost(t)).toBeCloseTo(3.75);
  });

  it('13. budget checks: over, near, and no-budget behavior', () => {
    const noBudget = addRecord(createTracker(), record(100));
    expect(isOverBudget(noBudget)).toBe(false);
    expect(isNearBudget(noBudget, 0.8)).toBe(false);

    let t = createTracker(10);
    t = addRecord(t, record(8.5));
    expect(isOverBudget(t)).toBe(false);
    expect(isNearBudget(t, 0.8)).toBe(true); // 8.5 >= 8.0

    t = addRecord(t, record(2)); // total 10.5 > 10
    expect(isOverBudget(t)).toBe(true);
  });
});
