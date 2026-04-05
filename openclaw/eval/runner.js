#!/usr/bin/env node

// Eval suite runner — runs queries against tiers, scores results
// Usage:
//   node openclaw/eval/runner.js --tier local --suite simple-intents
//   node openclaw/eval/runner.js --tier all --suite all

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { classify } from '../router/classifier.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUERIES_DIR = join(__dirname, 'queries');
const RESULTS_DIR = join(__dirname, 'results');

const SUITES = ['simple-intents', 'moderate', 'complex'];
const TIERS = ['local', 'groq', 'anthropic'];

function loadSuite(name) {
  const path = join(QUERIES_DIR, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadExpected() {
  const path = join(QUERIES_DIR, 'expected.json');
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function runTierQuery(tier, query) {
  const start = Date.now();
  try {
    // Dynamic import to avoid loading all tiers
    const mod = await import(`../router/tiers/${tier}.js`);
    if (mod.available && !mod.available()) {
      return { success: false, error: 'tier_unavailable', latency_ms: Date.now() - start };
    }
    const result = await mod.complete(query);
    return {
      success: true,
      response: result.response,
      model: result.model,
      tokens_in: result.tokens_in || 0,
      tokens_out: result.tokens_out || 0,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return { success: false, error: err.message, latency_ms: Date.now() - start };
  }
}

function scoreClassification(queryId, expected) {
  const exp = expected.find((e) => e.query_id === queryId);
  if (!exp) return { classification_correct: null };
  return { expected_classification: exp.expected_classification };
}

async function runSuite(tierName, suiteName) {
  const queries = loadSuite(suiteName);
  const expected = loadExpected();
  const results = [];

  console.log(`\nRunning ${suiteName} on ${tierName} (${queries.length} queries)...`);

  for (const q of queries) {
    const classification = classify(q.query);
    const classInfo = scoreClassification(q.id, expected);

    if (tierName === 'classifier') {
      // Classification-only eval (no model call)
      const pass = classification === classInfo.expected_classification;
      results.push({
        id: q.id,
        query: q.query,
        classification,
        expected_classification: classInfo.expected_classification,
        pass,
      });
      console.log(`  ${pass ? '✓' : '✗'} ${q.id}: "${q.query}" → ${classification} (expected: ${classInfo.expected_classification})`);
      continue;
    }

    const result = await runTierQuery(tierName, q.query);
    const pass = result.success;
    results.push({
      id: q.id,
      query: q.query,
      classification,
      expected_classification: classInfo.expected_classification,
      tier: tierName,
      ...result,
      pass,
    });
    const icon = pass ? '✓' : '✗';
    const latency = result.latency_ms ? `${result.latency_ms}ms` : 'n/a';
    console.log(`  ${icon} ${q.id}: "${q.query}" [${latency}]`);
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n  Result: ${passed}/${results.length} passed`);

  return {
    tier: tierName,
    suite: suiteName,
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

function saveResult(evalResult) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-${evalResult.tier}-${evalResult.suite}.json`;
  const path = join(RESULTS_DIR, filename);
  writeFileSync(path, JSON.stringify(evalResult, null, 2));
  console.log(`  Saved: ${path}`);
}

async function main() {
  const args = process.argv.slice(2);
  const tierIdx = args.indexOf('--tier');
  const suiteIdx = args.indexOf('--suite');

  const tierArg = tierIdx >= 0 ? args[tierIdx + 1] : 'classifier';
  const suiteArg = suiteIdx >= 0 ? args[suiteIdx + 1] : 'all';

  const tiersToRun = tierArg === 'all' ? ['classifier', ...TIERS] : [tierArg];
  const suitesToRun = suiteArg === 'all' ? SUITES : [suiteArg];

  for (const tier of tiersToRun) {
    for (const suite of suitesToRun) {
      const result = await runSuite(tier, suite);
      saveResult(result);
    }
  }
}

main().catch((err) => {
  console.error('Eval error:', err);
  process.exit(1);
});
