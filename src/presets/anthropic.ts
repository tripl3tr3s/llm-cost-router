import type { PricingTable } from '../cost.js';
import type { RouterConfig } from '../router.js';

/**
 * Anthropic pricing (USD per 1M tokens). Update as the price list changes; the
 * core library never hardcodes these - they live here as a swappable preset.
 */
export const anthropicPricing: PricingTable = {
  models: {
    'claude-haiku-4-5': { input: 1.0, output: 5.0 },
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-sonnet-5': { input: 2.0, output: 10.0 },
    'claude-opus-4-8': { input: 5.0, output: 25.0 },
  },
  fallback: { input: 3.0, output: 15.0 },
  // Anthropic 5-minute ephemeral cache economics.
  cacheWriteMultiplier: 1.25,
  cacheReadMultiplier: 0.1,
};

/**
 * A sensible Anthropic routing preset: short extraction/classification -> Haiku,
 * standard work -> Sonnet, deep reasoning -> Opus.
 */
export const anthropicRouter: RouterConfig = {
  tiers: {
    small: 'claude-haiku-4-5',
    default: 'claude-sonnet-4-6',
    large: 'claude-opus-4-8',
  },
  cheapTier: { name: 'small', maxInputChars: 1000 },
};
