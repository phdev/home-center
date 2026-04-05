// Per-token pricing by tier/model (USD)
// Updated 2026-04-05 — check provider pricing pages for changes

const PRICING = {
  cache: { input: 0, output: 0 },
  edge: { input: 0, output: 0 },
  local: { input: 0, output: 0 },
  groq: {
    'llama-3.3-70b-versatile': { input: 0.59 / 1e6, output: 0.79 / 1e6 },
    'llama-3.1-8b-instant': { input: 0.05 / 1e6, output: 0.08 / 1e6 },
    default: { input: 0.59 / 1e6, output: 0.79 / 1e6 },
  },
  anthropic: {
    'claude-sonnet-4-20250514': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
    'claude-opus-4-20250514': { input: 15.0 / 1e6, output: 75.0 / 1e6 },
    default: { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  },
};

export function estimateCost(tier, tokensIn, tokensOut, model) {
  const tierPricing = PRICING[tier];
  if (!tierPricing) return 0;

  // Flat-rate tiers (cache, edge, local)
  if (tierPricing.input !== undefined) {
    return tierPricing.input * tokensIn + tierPricing.output * tokensOut;
  }

  // Model-specific tiers (groq, anthropic)
  const modelPricing = tierPricing[model] || tierPricing.default;
  return modelPricing.input * tokensIn + modelPricing.output * tokensOut;
}

export function actualCost(logEntry) {
  const { tier_used, model, tokens_in, tokens_out } = logEntry;
  const tier = tier_used.startsWith('anthropic') ? 'anthropic' : tier_used;
  return estimateCost(tier, tokens_in || 0, tokens_out || 0, model);
}
