/**
 * Cache-accurate LLM cost tracking.
 *
 * Pricing is data (`PricingTable`). Uncached input/output use the base price;
 * cached tokens apply provider cache multipliers (a cache WRITE costs more than
 * base input, a cache READ far less). All functions are pure and immutable.
 */

export interface PricingTable {
  /** USD per 1M tokens, per model id. */
  models: Record<string, { input: number; output: number }>;
  /** Used when a model id is not in `models`. */
  fallback: { input: number; output: number };
  /** Cache-write multiplier relative to base input. Default 1.25. */
  cacheWriteMultiplier?: number;
  /** Cache-read multiplier relative to base input. Default 0.10. */
  cacheReadMultiplier?: number;
}

export const DEFAULT_CACHE_WRITE_MULTIPLIER = 1.25;
export const DEFAULT_CACHE_READ_MULTIPLIER = 0.1;

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Tokens served from cache (billed at the read multiplier). */
  readonly cacheReadTokens?: number;
  /** Tokens written to cache (billed at the write multiplier). */
  readonly cacheWriteTokens?: number;
}

export interface CostBreakdown {
  readonly inputCost: number;
  readonly outputCost: number;
  readonly cacheReadCost: number;
  readonly cacheWriteCost: number;
  readonly totalCost: number;
}

const PER_MILLION = 1_000_000;

/** Cache-accurate USD breakdown for a single model call. */
export function calculateCost(
  pricing: PricingTable,
  model: string,
  usage: TokenUsage
): CostBreakdown {
  const price = pricing.models[model] ?? pricing.fallback;
  const writeMultiplier = pricing.cacheWriteMultiplier ?? DEFAULT_CACHE_WRITE_MULTIPLIER;
  const readMultiplier = pricing.cacheReadMultiplier ?? DEFAULT_CACHE_READ_MULTIPLIER;

  const inputCost = (usage.inputTokens / PER_MILLION) * price.input;
  const outputCost = (usage.outputTokens / PER_MILLION) * price.output;
  const cacheReadCost =
    ((usage.cacheReadTokens ?? 0) / PER_MILLION) * price.input * readMultiplier;
  const cacheWriteCost =
    ((usage.cacheWriteTokens ?? 0) / PER_MILLION) * price.input * writeMultiplier;

  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost: inputCost + outputCost + cacheReadCost + cacheWriteCost,
  };
}

export interface CostRecord {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly feature: string;
  readonly timestamp: number;
}

export interface CostTracker {
  readonly records: readonly CostRecord[];
  readonly budgetLimitUsd?: number;
}

/** Create an empty tracker, optionally with a session budget. */
export function createTracker(budgetLimitUsd?: number): CostTracker {
  return { records: [], budgetLimitUsd };
}

export function createCostRecord(
  pricing: PricingTable,
  model: string,
  usage: TokenUsage,
  feature: string
): CostRecord {
  return {
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: calculateCost(pricing, model, usage).totalCost,
    feature,
    timestamp: Date.now(),
  };
}

/** Return a NEW tracker with `record` appended. The input is never mutated. */
export function addRecord(tracker: CostTracker, record: CostRecord): CostTracker {
  return { ...tracker, records: [...tracker.records, record] };
}

export function totalCost(tracker: CostTracker): number {
  return tracker.records.reduce((sum, r) => sum + r.costUsd, 0);
}

export function isOverBudget(tracker: CostTracker): boolean {
  if (tracker.budgetLimitUsd === undefined) return false;
  return totalCost(tracker) > tracker.budgetLimitUsd;
}

export function isNearBudget(tracker: CostTracker, warnThreshold: number): boolean {
  if (tracker.budgetLimitUsd === undefined) return false;
  return totalCost(tracker) >= tracker.budgetLimitUsd * warnThreshold;
}
