#!/usr/bin/env node

// Aggregates daily log files into JSON for the GitHub Pages dashboard
// Usage:
//   node scripts/aggregate-logs.js             → routing-history.json
//   node scripts/aggregate-logs.js --costs     → cost-history.json

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = './openclaw/logs';

function loadDailyLogs() {
  let files;
  try {
    files = readdirSync(LOGS_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch {
    return [];
  }
  files.sort();
  // Last 30 days
  const recent = files.slice(-30);
  return recent.map((f) => ({
    date: f.replace('.json', ''),
    entries: JSON.parse(readFileSync(join(LOGS_DIR, f), 'utf-8')),
  }));
}

function routingHistory(days) {
  return days.map(({ date, entries }) => {
    const byTier = { cache: 0, local: 0, groq: 0, anthropic: 0 };
    const latencies = { cache: [], local: [], groq: [], anthropic: [] };
    let totalCost = 0;
    let cacheHits = 0;

    for (const e of entries) {
      const baseTier = e.tier_used.startsWith('anthropic') ? 'anthropic' : e.tier_used;
      if (baseTier in byTier) byTier[baseTier]++;
      if (baseTier in latencies) latencies[baseTier].push(e.latency_ms);
      totalCost += e.cost_usd || 0;
      if (e.cache_hit) cacheHits++;
    }

    const avgLatency = {};
    for (const [tier, arr] of Object.entries(latencies)) {
      avgLatency[tier] = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    }

    return {
      date,
      total_queries: entries.length,
      by_tier: byTier,
      cache_hit_rate: entries.length > 0 ? Math.round((cacheHits / entries.length) * 1000) / 1000 : 0,
      avg_latency_ms: avgLatency,
      total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    };
  });
}

function costHistory(days) {
  return days.map(({ date, entries }) => {
    let groq = 0;
    let anthropicSonnet = 0;
    let anthropicOpus = 0;

    for (const e of entries) {
      if (e.tier_used === 'groq') groq += e.cost_usd || 0;
      else if (e.tier_used === 'anthropic-sonnet') anthropicSonnet += e.cost_usd || 0;
      else if (e.tier_used === 'anthropic-opus') anthropicOpus += e.cost_usd || 0;
    }

    return {
      date,
      groq: Math.round(groq * 1e6) / 1e6,
      anthropic_sonnet: Math.round(anthropicSonnet * 1e6) / 1e6,
      anthropic_opus: Math.round(anthropicOpus * 1e6) / 1e6,
      total: Math.round((groq + anthropicSonnet + anthropicOpus) * 1e6) / 1e6,
    };
  });
}

const days = loadDailyLogs();
const isCosts = process.argv.includes('--costs');

if (isCosts) {
  console.log(JSON.stringify(costHistory(days), null, 2));
} else {
  console.log(JSON.stringify(routingHistory(days), null, 2));
}
