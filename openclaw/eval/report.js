#!/usr/bin/env node

// Generates eval report JSON consumed by dashboards
// Reads latest eval results from openclaw/eval/results/
// Output: JSON to stdout (pipe to file)

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

function getLatestResults() {
  let files;
  try {
    files = readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  // Group by tier-suite, keep latest date
  const latest = {};
  for (const file of files) {
    // Format: YYYY-MM-DD-tier-suite.json
    const match = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)-(.+)\.json$/);
    if (!match) continue;
    const [, date, tier, suite] = match;
    const key = `${tier}-${suite}`;
    if (!latest[key] || date > latest[key].date) {
      latest[key] = { date, file, tier, suite };
    }
  }

  return Object.values(latest).map((entry) => {
    const data = JSON.parse(readFileSync(join(RESULTS_DIR, entry.file), 'utf-8'));
    return { ...entry, data };
  });
}

function buildReport(results) {
  const tiers = {};

  for (const { tier, suite, data } of results) {
    if (!tiers[tier]) {
      tiers[tier] = { model: null, suites: {} };
    }

    const avgLatency = data.results
      .filter((r) => r.latency_ms)
      .reduce((sum, r, _, arr) => sum + r.latency_ms / arr.length, 0);

    const avgCost = 0; // Cost calculated from log entries, not eval

    // Try to find model from results
    const model = data.results.find((r) => r.model)?.model || null;
    if (model) tiers[tier].model = model;

    tiers[tier].suites[suite] = {
      pass: data.passed,
      fail: data.failed,
      total: data.total,
      avg_latency_ms: Math.round(avgLatency),
      avg_cost: avgCost,
      timestamp: data.timestamp,
    };
  }

  // Generate routing recommendation based on pass rates
  const recommendation = {};
  const complexityLevels = {
    simple: 'simple-intents',
    moderate: 'moderate',
    complex: 'complex',
    hard: 'complex',
  };
  const tierPriority = ['local', 'groq', 'anthropic-sonnet', 'anthropic-opus'];

  for (const [complexity, suite] of Object.entries(complexityLevels)) {
    // Find cheapest tier with >80% pass rate
    let best = complexity === 'hard' ? 'anthropic-opus' : 'anthropic-sonnet';
    for (const tier of tierPriority) {
      const baseTier = tier.replace('-sonnet', '').replace('-opus', '');
      if (tiers[baseTier]?.suites[suite]?.pass / (tiers[baseTier]?.suites[suite]?.total || 1) > 0.8) {
        best = tier;
        break;
      }
    }
    recommendation[complexity] = best;
  }

  return {
    generated_at: new Date().toISOString(),
    tiers,
    recommendation,
  };
}

const results = getLatestResults();
const report = buildReport(results);
console.log(JSON.stringify(report, null, 2));
