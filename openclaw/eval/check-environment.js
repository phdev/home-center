#!/usr/bin/env node

// Captures eval-relevant model configuration and checks Worker drift.

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '../router/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const WRANGLER_PATH = join(REPO_ROOT, 'worker', 'wrangler.toml');
// Precedence: WORKER_HEALTH_URL env override > production worker default.
// To test local Wrangler dev, set WORKER_HEALTH_URL=http://localhost:8787/api/health.
const DEFAULT_WORKER_HEALTH_URL = 'https://home-center-api.phhowell.workers.dev/api/health';
const ANTHROPIC_JUDGE_MODEL = process.env.JUDGE_MODEL || 'claude-sonnet-4-6';

const LIVE_MODEL_KEYS = {
  OPENAI_MODEL: 'openaiModel',
  OPENAI_IMAGE_MODEL: 'openaiImageModel',
  OPENAI_ENHANCE_MODEL: 'openaiEnhanceModel',
};

function parseTomlValue(raw) {
  const trimmed = raw.trim();
  const withoutComment = trimmed.replace(/\s+#.*$/, '').trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

export function readWranglerDeclaredModels(path = WRANGLER_PATH) {
  const content = readFileSync(path, 'utf-8');
  const declared = {};
  let inVars = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^\[.+\]$/.test(trimmed)) {
      inVars = trimmed === '[vars]';
      continue;
    }
    if (!inVars) continue;

    const match = trimmed.match(/^([A-Z0-9_]*_MODEL)\s*=\s*(.+)$/);
    if (match) {
      declared[match[1]] = parseTomlValue(match[2]);
    }
  }

  return declared;
}

export async function fetchWorkerHealth(url = process.env.WORKER_HEALTH_URL || DEFAULT_WORKER_HEALTH_URL) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`worker health returned ${res.status}: ${detail.slice(0, 300)}`);
  }
  return await res.json();
}

function extractLiveModels(health) {
  const live = {};
  for (const [key, value] of Object.entries(health || {})) {
    if (/model/i.test(key) && typeof value === 'string') {
      live[key] = value;
    }
  }
  return live;
}

export function compareModels(declared, live) {
  const rows = [];
  let driftDetected = false;

  for (const [declaredKey, declaredValue] of Object.entries(declared)) {
    const liveKey = LIVE_MODEL_KEYS[declaredKey];
    const liveValue = liveKey ? live[liveKey] : undefined;
    const comparable = liveKey && Object.prototype.hasOwnProperty.call(live, liveKey);
    const matches = comparable ? declaredValue === liveValue : null;

    if (comparable && !matches) driftDetected = true;
    rows.push({
      declared_key: declaredKey,
      declared: declaredValue,
      live_key: liveKey || null,
      live: comparable ? liveValue : null,
      matches,
    });
  }

  return { rows, drift_detected: driftDetected };
}

export async function captureEnvironment(options = {}) {
  const declared = readWranglerDeclaredModels(options.wranglerPath);
  let health = {};
  let healthError = null;

  try {
    health = await fetchWorkerHealth(options.healthUrl);
  } catch (err) {
    healthError = err.message;
  }

  const live = extractLiveModels(health);
  const comparison = compareModels(declared, live);

  return {
    captured_at: new Date().toISOString(),
    wrangler_declared: declared,
    worker_live: live,
    worker_health_url: options.healthUrl || process.env.WORKER_HEALTH_URL || DEFAULT_WORKER_HEALTH_URL,
    worker_health_error: healthError,
    drift_detected: healthError ? true : comparison.drift_detected,
    anthropic_judge_model: ANTHROPIC_JUDGE_MODEL,
    anthropic_router_models: {
      non_hard: config.tiers.anthropic.models.sonnet,
      hard: config.tiers.anthropic.models.opus,
    },
    comparison: comparison.rows,
  };
}

export function printEnvironmentDiff(environment) {
  console.log('OpenClaw eval environment');
  console.log(`  captured_at: ${environment.captured_at}`);
  console.log(`  worker_health_url: ${environment.worker_health_url}`);
  if (environment.worker_health_error) {
    console.log(`  worker_health_error: ${environment.worker_health_error}`);
  }

  console.log('\nModel drift check:');
  for (const row of environment.comparison) {
    const status = row.matches === true ? 'OK' : row.matches === false ? 'DRIFT' : 'NO_LIVE_FIELD';
    const live = row.live_key ? `${row.live_key}=${row.live ?? '(not reported)'}` : '(no live mapping)';
    console.log(`  ${status} ${row.declared_key}=${row.declared} :: ${live}`);
  }

  console.log('\nRouter pins:');
  console.log(`  anthropic non-hard: ${environment.anthropic_router_models.non_hard}`);
  console.log(`  anthropic hard: ${environment.anthropic_router_models.hard}`);
  console.log(`  anthropic judge: ${environment.anthropic_judge_model}`);

  console.log(`\nDrift detected: ${environment.drift_detected ? 'yes' : 'no'}`);
}

async function main() {
  const args = process.argv.slice(2);
  const warnOnly = args.includes('--warn-only');
  const environment = await captureEnvironment();
  printEnvironmentDiff(environment);

  if (environment.drift_detected && !warnOnly) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Environment check failed:', err.message);
    process.exit(1);
  });
}
