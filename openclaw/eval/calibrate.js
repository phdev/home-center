#!/usr/bin/env node

// Reads latest compare results and recommends minimum tiers by classification.

import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { wilsonInterval } from './stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');
const TIER_ORDER = ['local', 'knowledge-bridge', 'groq', 'anthropic-sonnet', 'anthropic-opus'];
const REC_LOWER_CI = Number.parseFloat(process.env.EVAL_REC_LOWER_CI || '0.8');

function latestCompareFiles() {
  if (!existsSync(RESULTS_DIR)) return [];
  const latest = {};
  for (const file of readdirSync(RESULTS_DIR)) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})-compare-(.+)\.json$/);
    if (!match) continue;
    const [, date, suite] = match;
    if (!latest[suite] || date > latest[suite].date) {
      latest[suite] = { date, suite, file };
    }
  }
  return Object.values(latest).map((entry) => ({
    ...entry,
    data: JSON.parse(readFileSync(join(RESULTS_DIR, entry.file), 'utf-8')),
  }));
}

function currentRouterTier(classification) {
  // Mirrors openclaw/router/index.js at the policy level, assuming all tiers are healthy.
  if (classification === 'knowledge') return 'knowledge-bridge';
  if (classification === 'escalate') return 'anthropic-sonnet';
  return 'local';
}

function tierRank(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function tierTrials(tierResult) {
  if (!tierResult) return { passes: 0, total: 0 };
  if (Number.isFinite(tierResult.pass_count) && Number.isFinite(tierResult.n)) {
    return { passes: tierResult.pass_count, total: tierResult.n };
  }
  return { passes: tierResult.pass === true ? 1 : 0, total: 1 };
}

function buildCalibration(files, lowerCiThreshold = REC_LOWER_CI) {
  const byClass = {};
  const costSavings = [];

  for (const { suite, data } of files) {
    for (const row of data.results || []) {
      if (row.excluded) continue;
      const classification = suite === 'knowledge' ? 'knowledge' : (row.expected_classification_v2 || row.classification || suite);
      if (!byClass[classification]) {
        byClass[classification] = {
          total_queries: 0,
          tier_counts: Object.fromEntries(TIER_ORDER.map((tier) => [tier, { passes: 0, total: 0 }])),
        };
      }

      byClass[classification].total_queries++;
      for (const tier of TIER_ORDER) {
        const trials = tierTrials(row.tiers?.[tier]);
        byClass[classification].tier_counts[tier].passes += trials.passes;
        byClass[classification].tier_counts[tier].total += trials.total;
      }

      const routerTier = currentRouterTier(classification);
      if (
        row.cheapest_passing_tier &&
        tierRank(row.cheapest_passing_tier) < tierRank(routerTier)
      ) {
        costSavings.push({
          id: row.id,
          query: row.query,
          expected_classification: classification,
          router_tier: routerTier,
          cheapest_passing_tier: row.cheapest_passing_tier,
        });
      }
    }
  }

  const recommendations = {};
  for (const [classification, stats] of Object.entries(byClass)) {
    const tiers = {};
    let recommended = null;
    for (const tier of TIER_ORDER) {
      const counts = stats.tier_counts[tier];
      const passRate = counts.total ? counts.passes / counts.total : 0;
      const ci = wilsonInterval(counts.passes, counts.total);
      tiers[tier] = {
        passes: counts.passes,
        total: counts.total,
        pass_rate: passRate,
        pass_rate_pct: Math.round(passRate * 1000) / 10,
        pass_rate_ci_95: ci,
      };
      if (!recommended && ci[0] >= lowerCiThreshold) recommended = tier;
    }
    recommendations[classification] = {
      total_queries: stats.total_queries,
      tiers,
      recommended_minimum_tier: recommended,
      recommendation_reason: recommended ? `lower_ci_gte_${lowerCiThreshold}` : `none_qualifies_at_lower_ci_${lowerCiThreshold}`,
    };
  }

  return {
    lower_ci_threshold: lowerCiThreshold,
    recommendations,
    cost_savings_opportunities: costSavings,
  };
}

function formatPct(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatTier(rec, tier) {
  const stats = rec.tiers[tier];
  if (!stats?.total) return 'n/a';
  return `${formatPct(stats.pass_rate)} (${formatPct(stats.pass_rate_ci_95[0])}-${formatPct(stats.pass_rate_ci_95[1])})`;
}

function printMarkdown(calibration) {
  console.log('\n## Routing Calibration Summary\n');
  console.log(`Recommendation threshold: Wilson lower 95% CI >= ${calibration.lower_ci_threshold}`);
  console.log('');
  console.log('| Classification | Total queries | Local / Knowledge Bridge pass% (lo-hi) | Groq pass% (lo-hi) | Anthropic Sonnet pass% (lo-hi) | Anthropic Opus pass% (lo-hi) | Recommendation | Reason |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |');
  for (const [classification, rec] of Object.entries(calibration.recommendations)) {
    console.log(
      `| ${classification} | ${rec.total_queries} | ${formatTier(rec, 'local')} / ${formatTier(rec, 'knowledge-bridge')} | ${formatTier(rec, 'groq')} | ` +
        `${formatTier(rec, 'anthropic-sonnet')} | ${formatTier(rec, 'anthropic-opus')} | ` +
        `${rec.recommended_minimum_tier || 'none'} | ${rec.recommendation_reason} |`
    );
  }

  console.log('\n## Cost-Savings Opportunities\n');
  if (!calibration.cost_savings_opportunities.length) {
    console.log('No queries found where the inferred router tier is more expensive than the cheapest passing tier.');
    return;
  }
  for (const item of calibration.cost_savings_opportunities.slice(0, 20)) {
    console.log(`- ${item.id}: ${item.router_tier} -> ${item.cheapest_passing_tier} :: ${item.query}`);
  }
}

const files = latestCompareFiles();
if (!files.length) {
  console.error('No compare results found in openclaw/eval/results.');
  process.exit(1);
}

const calibration = buildCalibration(files);
printMarkdown(calibration);
console.log('\n```json');
console.log(JSON.stringify(calibration, null, 2));
console.log('```');
