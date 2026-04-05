#!/usr/bin/env node

// Model orchestration router — classify query, pick tier, call model, log result
// Usage:
//   CLI:    node openclaw/router/index.js --query "what's the weather"
//   Import: import { route } from './openclaw/router/index.js'

import { classify } from './classifier.js';
import config from './config.js';
import { logQuery, updateDashboardState } from './logger.js';
import * as cache from './tiers/cache.js';
import * as local from './tiers/local.js';
import * as groq from './tiers/groq.js';
import * as anthropic from './tiers/anthropic.js';

function logAndReturn(result, tierUsed, startTime, query, classification, extra = {}) {
  const latency = Date.now() - startTime;
  const entry = logQuery({
    query,
    classification,
    tier_used: tierUsed,
    model: result.model || null,
    latency_ms: latency,
    tokens_in: result.tokens_in || 0,
    tokens_out: result.tokens_out || 0,
    cache_hit: result.cache_hit || false,
    escalated_from: extra.escalated_from || null,
    success: true,
  });

  updateDashboardState();

  return {
    response: result.response,
    tier: tierUsed,
    classification,
    latency_ms: latency,
    cost_usd: entry.cost_usd,
    cache_hit: result.cache_hit || false,
    model: result.model || null,
  };
}

export async function route(query, context = {}) {
  const startTime = Date.now();
  const complexity = classify(query);

  // 1. Always check semantic cache first
  try {
    const cached = await cache.lookup(query);
    if (cached) {
      return logAndReturn(
        { response: cached.response, cache_hit: true, model: 'cache' },
        'cache',
        startTime,
        query,
        complexity
      );
    }
  } catch {
    // Cache failure is not fatal
  }

  // 2. Simple queries — try local first, fall through
  // 3. Route based on complexity + tier availability
  let escalatedFrom = null;

  // Try local for simple/moderate queries (or any if it's available)
  if (complexity !== 'hard' && local.available()) {
    try {
      const result = await local.complete(query, context);
      cache.store(query, result.response).catch(() => {});
      return logAndReturn(result, 'local', startTime, query, complexity);
    } catch {
      escalatedFrom = 'local';
    }
  }

  // Try Groq for non-hard queries when local unavailable
  if (complexity !== 'hard' && groq.available()) {
    try {
      const result = await groq.complete(query, context);
      cache.store(query, result.response).catch(() => {});
      return logAndReturn(result, 'groq', startTime, query, complexity, { escalated_from: escalatedFrom });
    } catch {
      escalatedFrom = escalatedFrom || 'groq';
    }
  }

  // Anthropic — sonnet for complex, opus for hard
  if (anthropic.available()) {
    const modelKey = complexity === 'hard' ? 'opus' : 'sonnet';
    const result = await anthropic.complete(query, context, modelKey);
    cache.store(query, result.response).catch(() => {});
    return logAndReturn(result, `anthropic-${modelKey}`, startTime, query, complexity, {
      escalated_from: escalatedFrom,
    });
  }

  // Nothing available
  const errorResult = {
    response: 'No model tiers are currently available. Please check configuration.',
    model: null,
    tokens_in: 0,
    tokens_out: 0,
  };
  logQuery({
    query,
    classification: complexity,
    tier_used: 'none',
    latency_ms: Date.now() - startTime,
    success: false,
  });
  updateDashboardState();
  return {
    response: errorResult.response,
    tier: 'none',
    classification: complexity,
    latency_ms: Date.now() - startTime,
    cost_usd: 0,
    cache_hit: false,
    model: null,
    error: true,
  };
}

// CLI mode
const args = process.argv.slice(2);
if (args.includes('--query')) {
  const idx = args.indexOf('--query');
  const query = args[idx + 1];
  if (!query) {
    console.error('Usage: node openclaw/router/index.js --query "your question"');
    process.exit(1);
  }
  route(query)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      cache.close();
    })
    .catch((err) => {
      console.error('Router error:', err.message);
      cache.close();
      process.exit(1);
    });
}
