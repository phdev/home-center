#!/usr/bin/env node

// Generates 30 days of realistic seed data for both dashboards
// Run: node scripts/generate-seed-data.js

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = './openclaw/logs';
const EVAL_RESULTS_DIR = './openclaw/eval/results';

if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
if (!existsSync(EVAL_RESULTS_DIR)) mkdirSync(EVAL_RESULTS_DIR, { recursive: true });

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SAMPLE_QUERIES = {
  simple: [
    'what time is it', "what's the weather", 'set a timer for 5 minutes',
    'turn off the lights', 'is it going to rain', 'show calendar',
    'good morning', "what's the temperature", 'stop', 'go back',
    'lights off', 'volume up', 'play music', 'show photos',
  ],
  moderate: [
    "what should we have for dinner", "when is the next soccer practice",
    "add milk to the grocery list", "what's on the calendar this weekend",
    "when does the dentist appointment start", "how long until Emma's birthday",
    "read me the latest school newsletter", "what homework does Liam have",
    "summarize today's school emails", "what events do we have on Monday",
    "tell me about tomorrow's weather", "when is the next family birthday",
  ],
  complex: [
    "plan dinners for the week around soccer practice",
    "Alison has a conflict between dentist and piano, what should we move",
    "summarize this week's school updates and flag anything I need to respond to",
    "plan a grocery list based on this week's meal plan",
    "analyze the kids' schedule and find a free evening for movie night",
  ],
  hard: [
    "review the kids' medical appointment schedule and flag overdue checkups",
  ],
};

const TIERS_FOR_COMPLEXITY = {
  simple: { cache: 0.7, local: 0.25, groq: 0.04, 'anthropic-sonnet': 0.01 },
  moderate: { cache: 0.55, local: 0.35, groq: 0.08, 'anthropic-sonnet': 0.02 },
  complex: { cache: 0.3, local: 0.4, groq: 0.2, 'anthropic-sonnet': 0.08, 'anthropic-opus': 0.02 },
  hard: { cache: 0.1, local: 0.15, groq: 0.15, 'anthropic-sonnet': 0.3, 'anthropic-opus': 0.3 },
};

const LATENCY_RANGES = {
  cache: [5, 20],
  local: [800, 2500],
  groq: [200, 600],
  'anthropic-sonnet': [1500, 3000],
  'anthropic-opus': [2500, 4000],
};

const MODELS = {
  cache: 'cache',
  local: 'qwen3.5:35b-a3b',
  groq: 'llama-3.3-70b-versatile',
  'anthropic-sonnet': 'claude-sonnet-4-20250514',
  'anthropic-opus': 'claude-opus-4-20250514',
};

const COST_PER_TOKEN = {
  cache: { input: 0, output: 0 },
  local: { input: 0, output: 0 },
  groq: { input: 0.59e-6, output: 0.79e-6 },
  'anthropic-sonnet': { input: 3e-6, output: 15e-6 },
  'anthropic-opus': { input: 15e-6, output: 75e-6 },
};

function pickTier(complexity) {
  const dist = TIERS_FOR_COMPLEXITY[complexity];
  const r = Math.random();
  let cumulative = 0;
  for (const [tier, prob] of Object.entries(dist)) {
    cumulative += prob;
    if (r <= cumulative) return tier;
  }
  return 'local';
}

function generateEntry(date, hour) {
  // Weight toward simple/moderate queries
  const complexityRoll = Math.random();
  let complexity;
  if (complexityRoll < 0.35) complexity = 'simple';
  else if (complexityRoll < 0.7) complexity = 'moderate';
  else if (complexityRoll < 0.95) complexity = 'complex';
  else complexity = 'hard';

  const query = pick(SAMPLE_QUERIES[complexity]);
  const tier = pickTier(complexity);
  const isCacheHit = tier === 'cache';
  const [minLat, maxLat] = LATENCY_RANGES[tier];
  const latency = randInt(minLat, maxLat);
  const tokensIn = isCacheHit ? 0 : randInt(8, complexity === 'complex' ? 120 : 40);
  const tokensOut = isCacheHit ? 0 : randInt(20, complexity === 'complex' ? 300 : 100);
  const pricing = COST_PER_TOKEN[tier];
  const cost = pricing.input * tokensIn + pricing.output * tokensOut;

  const minute = randInt(0, 59);
  const second = randInt(0, 59);
  const timestamp = new Date(date);
  timestamp.setHours(hour, minute, second);

  return {
    timestamp: timestamp.toISOString(),
    query,
    classification: complexity,
    tier_used: tier,
    model: MODELS[tier],
    latency_ms: latency,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: Math.round(cost * 1e8) / 1e8,
    cache_hit: isCacheHit,
    escalated_from: null,
    success: Math.random() > 0.02, // 98% success rate
  };
}

function generateDay(dateStr, dayIndex) {
  // Volume: 40-120 queries/day, more on weekends
  const date = new Date(dateStr);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const baseVolume = isWeekend ? randInt(70, 120) : randInt(40, 90);

  // Cache hit rate improves over time (simulating cache warming)
  // Adjust tier distribution slightly over time
  const entries = [];
  const activeHours = isWeekend ? [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] : [6, 7, 8, 12, 13, 17, 18, 19, 20, 21];

  for (let i = 0; i < baseVolume; i++) {
    const hour = pick(activeHours);
    entries.push(generateEntry(dateStr, hour));
  }

  // Sort by timestamp
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return entries;
}

// Generate 30 days of data
const today = new Date('2026-04-05');
const days = [];

for (let i = 29; i >= 0; i--) {
  const date = new Date(today);
  date.setDate(date.getDate() - i);
  const dateStr = date.toISOString().slice(0, 10);
  const entries = generateDay(dateStr, 29 - i);
  days.push({ dateStr, entries });

  const logPath = join(LOGS_DIR, `${dateStr}.json`);
  writeFileSync(logPath, JSON.stringify(entries, null, 2));
  console.log(`Generated ${dateStr}: ${entries.length} entries`);
}

// Generate dashboard-state.json from latest day
const latestDay = days[days.length - 1];
const latestEntries = latestDay.entries;
const tierStats = {
  edge: { status: 'disabled', color: 'gray' },
  cache: { status: 'ok', hits_today: 0 },
  local: { status: 'ok', queries_today: 0, avg_latency_ms: 0 },
  groq: { status: 'ok', queries_today: 0, cost_today_usd: 0 },
  anthropic: { status: 'ok', queries_today: 0, cost_today_usd: 0 },
};
let totalCost = 0;
const latencies = { local: [], groq: [], anthropic: [] };

for (const e of latestEntries) {
  totalCost += e.cost_usd;
  if (e.cache_hit) tierStats.cache.hits_today++;
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
  if (tier !== 'local') {
    tierStats[tier].cost_today_usd = Math.round(tierStats[tier].cost_today_usd * 1e6) / 1e6;
  }
}

const total = latestEntries.length;
const cacheHits = tierStats.cache.hits_today;
const localQ = tierStats.local.queries_today;
const groqQ = tierStats.groq.queries_today;
const anthQ = tierStats.anthropic.queries_today;
const lastEntry = latestEntries[latestEntries.length - 1];

const dashboardState = {
  updated_at: new Date().toISOString(),
  tiers: tierStats,
  today: {
    total_queries: total,
    cache_hit_rate: total > 0 ? Math.round((cacheHits / total) * 1000) / 1000 : 0,
    total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    routing_pct: {
      cache: total > 0 ? Math.round((cacheHits / total) * 1000) / 10 : 0,
      local: total > 0 ? Math.round((localQ / total) * 1000) / 10 : 0,
      groq: total > 0 ? Math.round((groqQ / total) * 1000) / 10 : 0,
      anthropic: total > 0 ? Math.round((anthQ / total) * 1000) / 10 : 0,
    },
  },
  last_query: lastEntry ? {
    text: lastEntry.query,
    tier: lastEntry.tier_used,
    latency_ms: lastEntry.latency_ms,
    timestamp: lastEntry.timestamp,
  } : null,
};

writeFileSync(join(LOGS_DIR, 'dashboard-state.json'), JSON.stringify(dashboardState, null, 2));
console.log('\nGenerated dashboard-state.json');

// Generate seed eval result
const seedEval = {
  tier: 'classifier',
  suite: 'simple-intents',
  timestamp: new Date().toISOString(),
  total: 18,
  passed: 17,
  failed: 1,
  results: [
    { id: 'simple_01', query: 'what time is it', classification: 'simple', expected_classification: 'simple', pass: true },
    { id: 'simple_02', query: 'set a timer for 10 minutes', classification: 'simple', expected_classification: 'simple', pass: true },
    { id: 'simple_03', query: 'turn off the living room lights', classification: 'simple', expected_classification: 'simple', pass: true },
    { id: 'simple_04', query: "what's the weather", classification: 'simple', expected_classification: 'simple', pass: true },
    { id: 'simple_05', query: 'is it going to rain tomorrow', classification: 'simple', expected_classification: 'simple', pass: true },
  ],
};

writeFileSync(join(EVAL_RESULTS_DIR, '2026-04-05-classifier-simple-intents.json'), JSON.stringify(seedEval, null, 2));

const seedEvalMod = {
  tier: 'classifier',
  suite: 'moderate',
  timestamp: new Date().toISOString(),
  total: 16,
  passed: 14,
  failed: 2,
  results: [],
};
writeFileSync(join(EVAL_RESULTS_DIR, '2026-04-05-classifier-moderate.json'), JSON.stringify(seedEvalMod, null, 2));

const seedEvalComplex = {
  tier: 'classifier',
  suite: 'complex',
  timestamp: new Date().toISOString(),
  total: 15,
  passed: 13,
  failed: 2,
  results: [],
};
writeFileSync(join(EVAL_RESULTS_DIR, '2026-04-05-classifier-complex.json'), JSON.stringify(seedEvalComplex, null, 2));

console.log('Generated seed eval results');
console.log('\nDone! Run scripts/aggregate-logs.js to populate dashboard data.');
