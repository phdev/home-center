import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import config from './config.js';
import { estimateCost } from './cost.js';

function getLogPath(date) {
  const dir = config.logsDir;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const dateStr = date.toISOString().slice(0, 10);
  return join(dir, `${dateStr}.json`);
}

function readLogFile(path) {
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return [];
  }
}

export function logQuery(entry) {
  const now = new Date();
  const logPath = getLogPath(now);
  const entries = readLogFile(logPath);

  const tier = entry.tier_used.startsWith('anthropic') ? 'anthropic' : entry.tier_used;
  const cost = estimateCost(tier, entry.tokens_in || 0, entry.tokens_out || 0, entry.model);

  const record = {
    timestamp: now.toISOString(),
    query: entry.query,
    classification: entry.classification,
    tier_used: entry.tier_used,
    model: entry.model || null,
    latency_ms: entry.latency_ms,
    tokens_in: entry.tokens_in || 0,
    tokens_out: entry.tokens_out || 0,
    cost_usd: cost,
    cache_hit: entry.cache_hit || false,
    escalated_from: entry.escalated_from || null,
    success: entry.success !== false,
  };

  entries.push(record);
  writeFileSync(logPath, JSON.stringify(entries, null, 2));
  return record;
}

export function updateDashboardState() {
  const now = new Date();
  const logPath = getLogPath(now);
  const entries = readLogFile(logPath);

  const tierStats = {
    edge: { status: 'disabled', color: 'gray' },
    cache: { status: 'ok', hits_today: 0 },
    local: { status: config.tiers.local.enabled ? 'ok' : 'disabled', queries_today: 0, avg_latency_ms: 0 },
    groq: { status: config.tiers.groq.enabled ? 'ok' : 'disabled', queries_today: 0, cost_today_usd: 0 },
    anthropic: { status: config.tiers.anthropic.enabled ? 'ok' : 'disabled', queries_today: 0, cost_today_usd: 0 },
  };

  let totalCost = 0;
  const latencies = { local: [], groq: [], anthropic: [] };

  for (const e of entries) {
    totalCost += e.cost_usd;
    if (e.cache_hit) {
      tierStats.cache.hits_today++;
    }
    const baseTier = e.tier_used.startsWith('anthropic') ? 'anthropic' : e.tier_used;
    if (baseTier === 'local') {
      tierStats.local.queries_today++;
      latencies.local.push(e.latency_ms);
    } else if (baseTier === 'groq') {
      tierStats.groq.queries_today++;
      tierStats.groq.cost_today_usd += e.cost_usd;
      latencies.groq.push(e.latency_ms);
    } else if (baseTier === 'anthropic') {
      tierStats.anthropic.queries_today++;
      tierStats.anthropic.cost_today_usd += e.cost_usd;
      latencies.anthropic.push(e.latency_ms);
    }
  }

  for (const tier of ['local', 'groq', 'anthropic']) {
    const arr = latencies[tier];
    tierStats[tier].avg_latency_ms = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  }

  const total = entries.length;
  const cacheHits = tierStats.cache.hits_today;
  const localQ = tierStats.local.queries_today;
  const groqQ = tierStats.groq.queries_today;
  const anthQ = tierStats.anthropic.queries_today;

  const lastEntry = entries[entries.length - 1];

  const state = {
    updated_at: now.toISOString(),
    tiers: tierStats,
    today: {
      total_queries: total,
      cache_hit_rate: total > 0 ? cacheHits / total : 0,
      total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
      routing_pct: {
        cache: total > 0 ? Math.round((cacheHits / total) * 1000) / 10 : 0,
        local: total > 0 ? Math.round((localQ / total) * 1000) / 10 : 0,
        groq: total > 0 ? Math.round((groqQ / total) * 1000) / 10 : 0,
        anthropic: total > 0 ? Math.round((anthQ / total) * 1000) / 10 : 0,
      },
    },
    last_query: lastEntry
      ? {
          text: lastEntry.query,
          tier: lastEntry.tier_used,
          latency_ms: lastEntry.latency_ms,
          timestamp: lastEntry.timestamp,
        }
      : null,
  };

  const statePath = config.dashboardStatePath;
  const stateDir = statePath.substring(0, statePath.lastIndexOf('/'));
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  return state;
}
