# llm-cost-router

[![CI](https://github.com/tripl3tr3s/llm-cost-router/actions/workflows/ci.yml/badge.svg)](https://github.com/tripl3tr3s/llm-cost-router/actions/workflows/ci.yml)
![coverage](https://img.shields.io/badge/coverage-%E2%89%A590%25-brightgreen)
![types](https://img.shields.io/badge/types-included-blue)

Tiered model routing + **cache-accurate** LLM cost tracking. Immutable, provider-agnostic,
dependency-free, with an Anthropic pricing preset in the box.

## The problem

Two disciplines every production LLM app needs and most demos skip:

1. **Route the cheapest model that can do the task.** Classification/extraction goes to a
   small model; multi-step reasoning goes to a large one. Hardcoding one model everywhere
   is either too expensive or too weak.
2. **Meter spend accurately - including prompt-cache multipliers.** Naive trackers do
   `tokens x base price` and silently miscount cached tokens. A cache **write** costs
   _more_ than base input (~1.25x); a cache **read** costs far _less_ (~0.10x). Get this
   wrong and your unit economics are fiction.

`llm-cost-router` does both in ~200 lines of pure, immutable functions - no SDK, no
network, no classes to instantiate.

## Quickstart

```bash
pnpm add llm-cost-router
```

```ts
import {
  selectModel,
  anthropicRouter,
  anthropicPricing,
  createTracker,
  addRecord,
  createCostRecord,
  totalCost,
  isOverBudget,
} from 'llm-cost-router';

// Route by task tier. Short input on the cheap tier -> Haiku; long input escalates.
const model = selectModel(anthropicRouter, { tier: 'small', inputLength: 120 });
// -> 'claude-haiku-4-5'

// Meter a call (cache reads billed at 0.10x) and enforce a session budget.
let tracker = createTracker(0.05); // 5-cent budget
const record = createCostRecord(
  anthropicPricing,
  'claude-sonnet-4-6',
  { inputTokens: 2000, outputTokens: 800, cacheReadTokens: 5000 },
  'agent'
);
tracker = addRecord(tracker, record); // returns a NEW tracker; nothing is mutated

console.log(totalCost(tracker), isOverBudget(tracker));
```

Run the offline demo:

```bash
pnpm example
```

## How it works

Two independent, pure steps: **route** the request to a model, then **meter** the call
that model returns.

```
ROUTE                 selectModel(config, { tier, inputLength })
                              │
        ┌─────────────────────┼──────────────────────────────────────┐
   forceModel set?      cheap tier + short?      known tier?     unknown tier
        │                     │                       │                │
        ▼                     ▼                       ▼                ▼
   that model           cheap model             that tier's       default model
   (escape hatch)   (long input -> escalate)     model            (never throws)
```

```
METER      usage { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }
                                    │
                          ┌─────────▼──────────┐
                          │   calculateCost    │
                          └─────────┬──────────┘
        input*price + output*price + cacheRead*price*0.10 + cacheWrite*price*1.25
                                    │  CostBreakdown
                          ┌─────────▼──────────┐
                          │     addRecord      │ ──► CostTracker  (immutable: new each call)
                          └─────────┬──────────┘
                                    │
                    totalCost   ·   isNearBudget   ·   isOverBudget
```

## Design decisions

- **Pricing is data, not code.** Model ids and prices live in caller-supplied config; the
  Anthropic preset ships so it demos real while the core stays provider-agnostic.
- **Cache multipliers are first-class.** Write `1.25x` / read `0.10x` by default (real
  Anthropic ephemeral-cache economics), overridable per table. This is the differentiator.
- **Everything immutable.** `addRecord` returns a new tracker via spread; inputs are never
  mutated.
- **Scoped on purpose.** Thinking/effort params and the agent loop live in a separate
  package, [`agentic-tool-loop`](https://github.com/<github-user>/agentic-tool-loop).

## API

### Routing

```ts
interface RouterConfig {
  tiers: Record<string, string>; // tier name -> model id
  cheapTier?: { name: string; maxInputChars: number }; // cheap tier only when input is short
  forceModel?: string; // escape hatch; always wins
}
function selectModel(cfg: RouterConfig, task: { tier: string; inputLength: number }): string;
```

Resolution order: `forceModel` -> cheap tier (if short) -> cheap tier long input escalates
to default -> known tier -> unknown tier falls back to default (never throws for unknown
tiers). Model ids are **data**: bring your own `tiers`, or use `anthropicRouter`.

### Cost tracking

```ts
function calculateCost(pricing: PricingTable, model: string, usage: TokenUsage): CostBreakdown;
```

`PricingTable` is USD-per-1M-tokens per model, a `fallback` for unknown models, and
optional cache multipliers (default write `1.25`, read `0.10`). `calculateCost` returns a
full breakdown: `inputCost`, `outputCost`, `cacheReadCost`, `cacheWriteCost`, `totalCost`.

Immutable per-session accounting:

```ts
createTracker(budgetLimitUsd?)                 // empty tracker
addRecord(tracker, record) -> CostTracker      // returns a NEW tracker
totalCost(tracker) -> number
isOverBudget(tracker) -> boolean
isNearBudget(tracker, warnThreshold) -> boolean
```

## Develop

```bash
pnpm install
pnpm run build          # tsup -> dist (ESM + .d.ts)
pnpm run typecheck
pnpm run test
pnpm run test:coverage  # 90% gate
pnpm run lint
```

## Read the write-up

"Your LLM app's invoice is a bug you can't see: cache-accurate cost tracking + tiered
model routing in ~200 lines." - **[LinkedIn article link TBD](#)**

## License

MIT
