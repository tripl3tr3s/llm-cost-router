import { describe, expect, it } from 'vitest';

import { selectModel } from '../src/index.js';
import type { RouterConfig } from '../src/index.js';

const CFG: RouterConfig = {
  tiers: {
    small: 'model-small',
    default: 'model-default',
    large: 'model-large',
  },
  cheapTier: { name: 'small', maxInputChars: 1000 },
};

describe('selectModel', () => {
  it('1. forceModel wins over everything', () => {
    expect(selectModel({ ...CFG, forceModel: 'forced' }, { tier: 'large', inputLength: 5 })).toBe(
      'forced'
    );
  });

  it('2. selects the cheap tier when the tier matches and the input is short', () => {
    expect(selectModel(CFG, { tier: 'small', inputLength: 999 })).toBe('model-small');
  });

  it('3. escalates to default when the cheap tier is requested but the input is too long', () => {
    expect(selectModel(CFG, { tier: 'small', inputLength: 1000 })).toBe('model-default');
  });

  it('selects a known non-cheap tier directly', () => {
    expect(selectModel(CFG, { tier: 'large', inputLength: 5 })).toBe('model-large');
  });

  it('4. falls back to the default tier for an unknown tier (never throws)', () => {
    expect(selectModel(CFG, { tier: 'nonexistent', inputLength: 5 })).toBe('model-default');
  });

  it('falls back to the first tier when there is no explicit default', () => {
    const cfg: RouterConfig = { tiers: { only: 'model-only' } };
    expect(selectModel(cfg, { tier: 'unknown', inputLength: 5 })).toBe('model-only');
  });

  it('throws only when tiers is empty (misconfiguration)', () => {
    expect(() => selectModel({ tiers: {} }, { tier: 'x', inputLength: 0 })).toThrow(
      /at least one tier/
    );
  });
});
