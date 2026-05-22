#!/usr/bin/env node

// Generates eval report JSON consumed by dashboards
// Reads latest eval results from openclaw/eval/results/
// Output: JSON to stdout (pipe to file)

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { summarizeKnowledgeBridge } from '../knowledge-bridge.js';
import { summarize, wilsonInterval } from './stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');
const TIER_ORDER = ['local', 'knowledge-bridge', 'groq', 'anthropic-sonnet', 'anthropic-opus'];
const RESULT_FILE_TIERS = ['anthropic-sonnet', 'anthropic-opus', 'knowledge-bridge', 'anthropic', 'classifier', 'compare', 'local', 'groq'];
const REC_LOWER_CI = Number.parseFloat(process.env.EVAL_REC_LOWER_CI || '0.8');

function parseResultFilename(file) {
  const match = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.json$/);
  if (!match) return null;
  const [, date, rest] = match;
  for (const tier of RESULT_FILE_TIERS) {
    const prefix = `${tier}-`;
    if (rest.startsWith(prefix)) {
      return { date, tier, suite: rest.slice(prefix.length) };
    }
  }
  const fallback = rest.match(/^(.+)-(.+)$/);
  if (!fallback) return null;
  return { date, tier: fallback[1], suite: fallback[2] };
}

function getLatestResults() {
  let files;
  try {
    files = readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const latest = {};
  for (const file of files) {
    const parsed = parseResultFilename(file);
    if (!parsed) continue;
    const { date, tier, suite } = parsed;
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

function ensureTier(tiers, tier) {
  if (!tiers[tier]) tiers[tier] = { model: null, suites: {} };
  return tiers[tier];
}

function tierSamplesFromSingleResult(data) {
  return (data.results || [])
    .filter((row) => !row.excluded)
    .map((row) => ({
      pass: row.pass === true,
      latency_ms: row.latency_ms || 0,
      model: row.model || null,
    }));
}

function tierSamplesFromCompareResult(data, tier) {
  return (data.results || [])
    .filter((row) => !row.excluded && row.tiers?.[tier])
    .flatMap((row) => {
      const tierResult = row.tiers[tier];
      if (Array.isArray(tierResult.samples)) {
        return tierResult.samples.map((sample) => ({
          pass: sample.pass === true,
          latency_ms: sample.latency_ms || 0,
          model: sample.model || tierResult.model || null,
        }));
      }
      return [{
        pass: tierResult.pass === true,
        latency_ms: tierResult.latency_ms || 0,
        model: tierResult.model || null,
      }];
    });
}

function suiteSummary(samples, timestamp) {
  const latencyStats = summarize(samples.map((sample) => sample.latency_ms || 0));
  const pass = samples.filter((sample) => sample.pass).length;
  const total = samples.length;
  const ci = wilsonInterval(pass, total);
  return {
    pass,
    fail: total - pass,
    total,
    latency_p50_ms: Math.round(latencyStats.p50),
    latency_p90_ms: Math.round(latencyStats.p90),
    latency_max_ms: Math.round(latencyStats.max),
    pass_rate: total ? pass / total : 0,
    pass_rate_ci_95: ci,
    avg_cost: 0,
    timestamp,
  };
}

function buildReport(results) {
  const tiers = {};

  for (const { tier, suite, data } of results) {
    if (data.mode === 'compare') {
      for (const comparedTier of data.tiers_compared || []) {
        const samples = tierSamplesFromCompareResult(data, comparedTier);
        const tierEntry = ensureTier(tiers, comparedTier);
        const model = samples.find((sample) => sample.model)?.model || null;
        if (model) tierEntry.model = model;
        tierEntry.suites[suite] = suiteSummary(samples, data.timestamp);
      }
      continue;
    }

    const samples = tierSamplesFromSingleResult(data);
    const tierEntry = ensureTier(tiers, tier);
    const model = samples.find((sample) => sample.model)?.model || null;
    if (model) tierEntry.model = model;
    tierEntry.suites[suite] = suiteSummary(samples, data.timestamp);
  }

  const recommendation = {};
  const complexityLevels = {
    simple: 'simple-intents',
    moderate: 'moderate',
    complex: 'complex',
    hard: 'complex',
    knowledge: 'knowledge',
  };

  for (const [complexity, suite] of Object.entries(complexityLevels)) {
    let best = null;
    for (const tier of TIER_ORDER) {
      const lowerCi = tiers[tier]?.suites[suite]?.pass_rate_ci_95?.[0] ?? 0;
      if (lowerCi >= REC_LOWER_CI) {
        best = tier;
        break;
      }
    }
    recommendation[complexity] = best;
  }

  return {
    generated_at: new Date().toISOString(),
    recommendation_threshold: { pass_rate_lower_ci_95: REC_LOWER_CI },
    tiers,
    recommendation,
    knowledge_bridge: summarizeKnowledgeBridge(),
  };
}

const results = getLatestResults();
const report = buildReport(results);
console.log(JSON.stringify(report, null, 2));
