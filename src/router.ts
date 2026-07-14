/**
 * Task-complexity model routing.
 *
 * A request is classified by the caller into a `tier` (e.g. `small` | `default`
 * | `large`); `selectModel` maps that to a concrete model id. Model ids are
 * data (`RouterConfig`), never hardcoded, so the same logic works for any
 * provider - an Anthropic preset ships in `presets/anthropic`.
 */

export interface RouterConfig {
  /** Tier name -> model id, e.g. `{ small: 'claude-haiku-4-5', default: 'claude-sonnet-4-6' }`. */
  tiers: Record<string, string>;
  /**
   * Optional "use the cheap tier only when the input is short" rule. When the
   * task targets this tier but the input is at/over `maxInputChars`, the router
   * escalates to the default tier instead.
   */
  cheapTier?: { name: string; maxInputChars: number };
  /** Escape hatch (e.g. from an env var) that always wins. */
  forceModel?: string;
}

export interface RouteTask {
  tier: string;
  inputLength: number;
}

function pickDefault(tiers: Record<string, string>): string {
  const fallback = tiers.default ?? Object.values(tiers)[0];
  if (fallback === undefined) {
    throw new Error('RouterConfig.tiers must contain at least one tier');
  }
  return fallback;
}

/**
 * Resolve the model id for a task.
 *
 * Priority:
 *   1. `forceModel` (always wins).
 *   2. cheap tier requested + input short  -> the cheap model.
 *   3. cheap tier requested + input long   -> escalate to default.
 *   4. a known tier                        -> that tier's model.
 *   5. an unknown tier                     -> default (never throws for unknown tiers).
 */
export function selectModel(cfg: RouterConfig, task: RouteTask): string {
  if (cfg.forceModel) return cfg.forceModel;

  const { tiers, cheapTier } = cfg;

  if (cheapTier && task.tier === cheapTier.name) {
    if (task.inputLength < cheapTier.maxInputChars) {
      return tiers[cheapTier.name] ?? pickDefault(tiers);
    }
    // Cheap tier asked for, but the input is too large - escalate.
    return pickDefault(tiers);
  }

  return tiers[task.tier] ?? pickDefault(tiers);
}
