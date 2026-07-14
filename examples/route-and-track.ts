/**
 * Runnable demo (no API key): route two tasks to different models, then meter
 * the spend of a call - including a prompt-cache read - against a budget.
 *
 *   pnpm example
 */
import {
  addRecord,
  anthropicPricing,
  anthropicRouter,
  createCostRecord,
  createTracker,
  isNearBudget,
  selectModel,
  totalCost,
} from '../src/index.js';

// 1. Routing: a short classification goes cheap; a long reasoning task goes big.
const classify = selectModel(anthropicRouter, { tier: 'small', inputLength: 120 });
const analyze = selectModel(anthropicRouter, { tier: 'large', inputLength: 8000 });
console.log(`classify -> ${classify}`);
console.log(`analyze  -> ${analyze}`);

// 2. Cost tracking: meter a Sonnet call that read 5k tokens from cache.
let tracker = createTracker(0.05); // 5-cent session budget
const record = createCostRecord(
  anthropicPricing,
  'claude-sonnet-4-6',
  { inputTokens: 2000, outputTokens: 800, cacheReadTokens: 5000 },
  'agent'
);
tracker = addRecord(tracker, record);

console.log(`\ncall cost: $${record.costUsd.toFixed(6)}`);
console.log(`session total: $${totalCost(tracker).toFixed(6)}`);
console.log(`near budget (80%)? ${isNearBudget(tracker, 0.8)}`);
