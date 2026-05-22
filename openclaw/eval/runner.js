#!/usr/bin/env node

// Eval suite runner — runs queries against tiers, scores results
// Usage:
//   node openclaw/eval/runner.js --tier local --suite simple-intents
//   node openclaw/eval/runner.js --tier all --suite all

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import './env-loader.js';
import { classify } from '../router/classifier.js';
import { estimateCost } from '../router/cost.js';
import { captureEnvironment, printEnvironmentDiff } from './check-environment.js';
import { DETERMINISTIC_JUDGES, getJudgeStats, resetJudgeStats, scoreResponse } from './judges.js';
import { summarize, wilsonInterval } from './stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUERIES_DIR = join(__dirname, 'queries');
const RESULTS_DIR = join(__dirname, 'results');
const REPO_ROOT = join(__dirname, '..', '..');
const AGENTCI_FIXTURES_DIR = join(REPO_ROOT, 'agentci', 'fixtures');

const SUITES = ['simple-intents', 'moderate', 'complex'];
const TIERS = ['local', 'groq', 'anthropic'];
const EXTRA_SUITES = ['knowledge'];
const EXTRA_TIERS = ['knowledge-bridge'];
// Groq is dormant in the active router. Compare mode keeps it out by default;
// pass --include-groq when eval data needs to test whether a middle tier earns its slot.
const COMPARE_TIERS = ['local', 'anthropic-sonnet'];
const TIER_COST_ORDER = ['cache', 'local', 'knowledge-bridge', 'groq', 'anthropic-sonnet', 'anthropic-opus'];
const DEFAULT_EVAL_MAX_TOKENS = 2048;
const CONTEXT_FIXTURES = {
  simple_01: [
    'Current local time is 8:04 AM PDT on Sunday, May 10, 2026.',
    'Answer with the current time.',
  ],
  simple_04: [
    'Current weather for home: clear, 61 degrees F, light northwest wind.',
    'Answer with the current weather.',
  ],
  simple_05: [
    'Tomorrow forecast for home: rain likely after 2 PM, high 58 degrees F, low 49 degrees F.',
    'Answer with whether rain is expected tomorrow.',
  ],
  simple_06: [
    'Current outdoor temperature at home is 61 degrees F.',
    'Answer with the current outdoor temperature.',
  ],
  simple_11: [
    'Current weather for home: clear, 61 degrees F, light northwest wind.',
    'This is a display request; acknowledge showing the weather using the provided facts.',
  ],
  simple_13: [
    'Current outdoor temperature at home is 61 degrees F.',
    'Answer with the current temperature.',
  ],
  simple_16: [
    'Today forecast for home: no snow expected; clear this morning and partly cloudy this evening.',
    'Answer with whether snow is expected today.',
  ],
};

function loadSuite(name) {
  const path = join(QUERIES_DIR, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadExpected() {
  const path = join(QUERIES_DIR, 'expected.json');
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadAgentCiFixture(ref) {
  const path = ref.includes('/') ? join(REPO_ROOT, ref) : join(AGENTCI_FIXTURES_DIR, `${ref}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function runTierQuery(tier, query, context = {}) {
  const start = Date.now();
  try {
    const moduleTier = tier.startsWith('anthropic') ? 'anthropic' : tier;
    const { mod, source } = await loadTierModule(moduleTier);
    if (mod.available && !(await mod.available())) {
      return { success: false, error: 'tier_unavailable', latency_ms: Date.now() - start };
    }
    const modelKey = tier === 'anthropic-opus' ? 'opus' : tier === 'anthropic-sonnet' || tier === 'anthropic' ? 'sonnet' : undefined;
    const evalContext = { maxTokens: DEFAULT_EVAL_MAX_TOKENS, ...context, temperature: 0 };
    const result = modelKey ? await mod.complete(query, evalContext, modelKey) : await mod.complete(query, evalContext);
    const costTier = source === 'eval' ? 'local' : (moduleTier === 'anthropic' ? 'anthropic' : moduleTier);
    return {
      success: true,
      response: result.response,
      model: result.model,
      tokens_in: result.tokens_in || 0,
      tokens_out: result.tokens_out || 0,
      latency_ms: Date.now() - start,
      cost_usd: estimateCost(costTier, result.tokens_in || 0, result.tokens_out || 0, result.model),
      ...(result.knowledge_tier ? { knowledge_tier: result.knowledge_tier } : {}),
      ...(result.knowledge_model ? { knowledge_model: result.knowledge_model } : {}),
    };
  } catch (err) {
    return { success: false, error: err.message, latency_ms: Date.now() - start };
  }
}

async function loadTierModule(moduleTier) {
  try {
    return { mod: await import(`./tiers/${moduleTier}.js`), source: 'eval' };
  } catch (err) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND' && !String(err.message || '').includes(`eval/tiers/${moduleTier}.js`)) {
      throw err;
    }
  }
  return { mod: await import(`../router/tiers/${moduleTier}.js`), source: 'router' };
}

function buildEvalContext(query, classInfo, options = {}) {
  if (!classInfo.requires_context || !options.includeContext) return {};
  const fixtureRef = query.context_fixture_ref || query.context_fixture;
  if (fixtureRef) {
    const fixture = loadAgentCiFixture(fixtureRef);
    if (!fixture) return {};

    return {
      systemPrompt: [
        'You are evaluating Home Center. Use only the provided AgentCI fixture context.',
        'The rawData JSON below is the exact household state available to Home Center for this scenario.',
        'Do not invent household facts outside this fixture.',
        '',
        `Scenario: ${fixture.scenarioId || fixtureRef}`,
        `Time context: ${JSON.stringify(fixture.timeContext ?? null, null, 2)}`,
        `Command events: ${JSON.stringify(fixture.commandEvents ?? [], null, 2)}`,
        '',
        'Raw data:',
        JSON.stringify(fixture.rawData ?? {}, null, 2),
      ].join('\n'),
      eval_context_fixture: fixtureRef,
    };
  }

  const fixture = CONTEXT_FIXTURES[query.id];
  if (!fixture) return {};

  return {
    systemPrompt: [
      'You are evaluating a home assistant. Use only the provided runtime context for time, weather, and calendar facts.',
      'Do not claim you lack realtime access when the needed fact is present below.',
      '',
      'Runtime context:',
      ...fixture.map((line) => `- ${line}`),
    ].join('\n'),
    eval_context_fixture: query.id,
  };
}

function scoreClassification(query, expected) {
  const exp = expected.find((e) => e.query_id === query.id) ?? {};
  const inline = query.expected_classification_v2
    ? {
        expected_classification: query.expected_classification,
        expected_classification_v2: query.expected_classification_v2,
        expected_escalation_target_v2: query.expected_escalation_target_v2 || null,
        pass_criteria: query.criterion || query.pass_criteria,
        requires_action: query.requires_action,
        requires_context: query.requires_context,
      }
    : {};
  const merged = { ...exp, ...inline };
  if (!merged.expected_classification_v2) return { classification_correct: null };
  return {
    expected_classification: merged.expected_classification,
    expected_classification_v2: merged.expected_classification_v2,
    expected_escalation_target_v2: merged.expected_escalation_target_v2 || null,
    criterion: merged.pass_criteria || null,
    criteria: normalizeCriteria(merged.pass_criteria || null),
    requires_action: merged.requires_action === true,
    requires_context: merged.requires_context === true,
  };
}

function normalizeCriteria(criteria) {
  if (!criteria) return [];
  return Array.isArray(criteria) ? criteria : [criteria];
}

async function scoreCriteria(query, response, criteria) {
  const criteriaList = normalizeCriteria(criteria);
  const results = [];
  for (const criterion of criteriaList) {
    const judge = await scoreResponse(query, response, criterion);
    results.push({ criterion, ...judge });
  }
  return {
    pass: results.length > 0 && results.every((result) => result.pass),
    results,
  };
}

function primaryJudge(criteriaScore) {
  return criteriaScore.results[0] || null;
}

function criteriaResultFields(criteriaScore) {
  const primary = primaryJudge(criteriaScore);
  return {
    criteria_results: criteriaScore.results,
    ...(primary
      ? {
          judge_reason: primary.reason,
          judge_method: primary.method,
          judge_model: primary.judge_model || null,
          judge_cache_hit: primary.cache_hit || false,
        }
      : {}),
  };
}

function shapeMatch(response, judgedResponse) {
  const text = String(response || '');
  const judged = String(judgedResponse || '');
  if (!text || !judged) return false;

  const paragraphCount = (value) => String(value).split(/\n\s*\n/).filter((part) => part.trim()).length || 1;
  const paragraphDelta = Math.abs(paragraphCount(text) - paragraphCount(judged));
  const judgedLength = Math.max(1, judged.length);
  const lengthRatio = text.length / judgedLength;
  return paragraphDelta <= 1 && lengthRatio >= 0.75 && lengthRatio <= 1.25;
}

function statsWithSamples(samples, field) {
  const values = samples.map((sample) => Number(sample[field] || 0));
  return { ...summarize(values), samples: values };
}

function legacyFieldsFromFirstSample(samples) {
  const first = samples[0] || {};
  return {
    success: first.success === true,
    ...(first.response !== undefined ? { response: first.response } : {}),
    ...(first.model !== undefined ? { model: first.model } : {}),
    tokens_in: first.tokens_in || 0,
    tokens_out: first.tokens_out || 0,
    latency_ms: first.latency_ms || 0,
    cost_usd: first.cost_usd || 0,
    ...(first.error ? { error: first.error } : {}),
  };
}

function varianceFields(samples, judgedResponseIndex) {
  const passCount = samples.filter((sample) => sample.pass === true).length;
  const ci = wilsonInterval(passCount, samples.length);
  const shapeSamples = samples.filter((sample) => sample.success);
  const shapeMatchCount = shapeSamples.filter((sample) => sample.shape_match === true).length;
  return {
    n: samples.length,
    judged_response_index: judgedResponseIndex,
    latency_ms_stats: statsWithSamples(samples, 'latency_ms'),
    tokens_in_stats: statsWithSamples(samples, 'tokens_in'),
    tokens_out_stats: statsWithSamples(samples, 'tokens_out'),
    cost_usd_stats: statsWithSamples(samples, 'cost_usd'),
    pass_count: passCount,
    pass_rate: samples.length ? passCount / samples.length : 0,
    pass_rate_ci_95: ci,
    shape_match_rate: shapeSamples.length ? shapeMatchCount / shapeSamples.length : 0,
    samples,
  };
}

async function scoreReplicatedSamples(query, samples, criteria) {
  const criteriaList = normalizeCriteria(criteria);
  const judgedResponseIndex = samples.findIndex((sample) => sample.success && typeof sample.response === 'string');
  if (judgedResponseIndex === -1 || criteriaList.length === 0) {
    return {
      judgedResponseIndex: null,
      criteriaScore: { pass: false, results: [] },
      samples: samples.map((sample) => ({ ...sample, pass: false, shape_match: false, criteria_results: [] })),
    };
  }

  const judgedSample = samples[judgedResponseIndex];
  const judgedResults = [];
  for (const criterion of criteriaList) {
    const deterministic = DETERMINISTIC_JUDGES[criterion];
    if (deterministic) {
      const judge = await scoreResponse(query, judgedSample.response, criterion);
      judgedResults.push({ criterion, ...judge });
    } else {
      const judge = await scoreResponse(query, judgedSample.response, criterion);
      judgedResults.push({ criterion, ...judge });
    }
  }
  const judgedCriteriaScore = {
    pass: judgedResults.length > 0 && judgedResults.every((result) => result.pass),
    results: judgedResults,
  };

  const scoredSamples = [];
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    if (!sample.success) {
      scoredSamples.push({ ...sample, pass: false, shape_match: false, criteria_results: [] });
      continue;
    }

    const sampleShapeMatch = index === judgedResponseIndex ? true : shapeMatch(sample.response, judgedSample.response);
    const sampleResults = [];
    for (const judgedResult of judgedResults) {
      const deterministic = DETERMINISTIC_JUDGES[judgedResult.criterion];
      if (deterministic) {
        const judge = await scoreResponse(query, sample.response, judgedResult.criterion);
        sampleResults.push({ criterion: judgedResult.criterion, ...judge });
      } else if (index === judgedResponseIndex) {
        sampleResults.push(judgedResult);
      } else {
        sampleResults.push({
          criterion: judgedResult.criterion,
          pass: judgedResult.pass === true && sampleShapeMatch,
          reason: sampleShapeMatch ? 'shape_matched_judged_response' : 'shape_mismatch_judged_response',
          method: 'shape_match',
          judge_model: judgedResult.judge_model || null,
          cache_hit: false,
        });
      }
    }
    const pass = sampleResults.length > 0 && sampleResults.every((result) => result.pass);
    scoredSamples.push({
      ...sample,
      pass,
      shape_match: sampleShapeMatch,
      criteria_results: sampleResults,
    });
  }

  return { judgedResponseIndex, criteriaScore: judgedCriteriaScore, samples: scoredSamples };
}

async function runTierQueryReps(tierName, query, evalContext, criteria, reps) {
  const samples = [];
  for (let rep = 0; rep < reps; rep++) {
    const result = await runTierQuery(tierName, query, evalContext);
    samples.push({
      rep,
      ...result,
      call_success_pass: result.success === true,
      tokens_in: result.tokens_in || 0,
      tokens_out: result.tokens_out || 0,
      cost_usd: result.cost_usd || 0,
    });
  }

  const scored = await scoreReplicatedSamples(query, samples, criteria);
  const firstCriteriaScore = scored.samples[0]?.criteria_results
    ? {
        pass: scored.samples[0].pass === true,
        results: scored.samples[0].criteria_results,
      }
    : scored.criteriaScore;

  const row = {
    ...legacyFieldsFromFirstSample(scored.samples),
    call_success_pass: scored.samples[0]?.success === true,
    pass: scored.samples[0]?.pass === true,
    ...criteriaResultFields(firstCriteriaScore),
  };

  if (reps > 1) {
    Object.assign(row, varianceFields(scored.samples, scored.judgedResponseIndex));
  }

  return row;
}

function shouldExclude(classInfo, options = {}) {
  if (classInfo.requires_action && !options.includeAction) return 'requires_action';
  if (classInfo.requires_context && !options.includeContext) return 'requires_context';
  return null;
}

function classifyForEval(query) {
  const routeInfo = classify(query);
  return {
    classification: routeInfo.classification,
    escalation_target: routeInfo.escalation_target || null,
  };
}

function cheapestPassingTier(tiers, options = {}) {
  const { minPassRate = 0.8, minLowerCi = 0.5 } = options;
  const passing = Object.entries(tiers)
    .filter(([, result]) => {
      const passRate = result.pass_rate ?? (result.pass === true ? 1 : 0);
      const lowerCi = result.pass_rate_ci_95?.[0] ?? (result.pass === true ? 1 : 0);
      if (passRate < minPassRate) {
        result.qualification_rejection_reason = 'low_pass_rate';
        return false;
      }
      if (lowerCi < minLowerCi) {
        result.qualification_rejection_reason = 'wide_ci';
        return false;
      }
      delete result.qualification_rejection_reason;
      return true;
    })
    .sort((a, b) => {
      const costDelta = (a[1].cost_usd_stats?.mean ?? a[1].cost_usd ?? 0) - (b[1].cost_usd_stats?.mean ?? b[1].cost_usd ?? 0);
      if (costDelta !== 0) return costDelta;
      return TIER_COST_ORDER.indexOf(a[0]) - TIER_COST_ORDER.indexOf(b[0]);
    });
  return passing[0]?.[0] || null;
}

async function runSuite(tierName, suiteName, environment = null, options = {}) {
  const queries = loadSuite(suiteName);
  const expected = loadExpected();
  const results = [];
  const excludedActionIds = [];
  const excludedContextIds = [];

  console.log(`\nRunning ${suiteName} on ${tierName} (${queries.length} queries)...`);

  for (const q of queries) {
    const routeInfo = classifyForEval(q.query);
    const { classification } = routeInfo;
    const classInfo = scoreClassification(q, expected);

    if (tierName === 'classifier') {
      // Classification-only eval (no model call)
      const pass =
        classification === classInfo.expected_classification_v2 &&
        (classification !== 'escalate' || routeInfo.escalation_target === classInfo.expected_escalation_target_v2);
      results.push({
        id: q.id,
        query: q.query,
        classification,
        escalation_target: routeInfo.escalation_target,
        expected_classification: classInfo.expected_classification,
        expected_classification_v2: classInfo.expected_classification_v2,
        expected_escalation_target_v2: classInfo.expected_escalation_target_v2,
        pass,
      });
      console.log(
        `  ${pass ? '✓' : '✗'} ${q.id}: "${q.query}" → ${classification}` +
          `${routeInfo.escalation_target ? `/${routeInfo.escalation_target}` : ''} ` +
          `(expected: ${classInfo.expected_classification_v2}` +
          `${classInfo.expected_escalation_target_v2 ? `/${classInfo.expected_escalation_target_v2}` : ''})`
      );
      continue;
    }

    const exclusionReason = shouldExclude(classInfo, options);
    if (exclusionReason) {
      if (exclusionReason === 'requires_action') excludedActionIds.push(q.id);
      if (exclusionReason === 'requires_context') excludedContextIds.push(q.id);
      results.push({
        id: q.id,
        query: q.query,
        classification,
        escalation_target: routeInfo.escalation_target,
        expected_classification: classInfo.expected_classification,
        expected_classification_v2: classInfo.expected_classification_v2,
        expected_escalation_target_v2: classInfo.expected_escalation_target_v2,
        criterion: classInfo.criterion,
        requires_action: classInfo.requires_action,
        requires_context: classInfo.requires_context,
        tier: tierName,
        excluded: true,
        exclusion_reason: exclusionReason,
        pass: null,
      });
      console.log(`  - ${q.id}: "${q.query}" excluded (${exclusionReason})`);
      continue;
    }

    const evalContext = buildEvalContext(q, classInfo, options);
    const result = await runTierQueryReps(tierName, q.query, evalContext, classInfo.criteria, options.reps || 1);
    const pass = result.pass === true;
    results.push({
      id: q.id,
      query: q.query,
      classification,
      escalation_target: routeInfo.escalation_target,
      expected_classification: classInfo.expected_classification,
      expected_classification_v2: classInfo.expected_classification_v2,
      expected_escalation_target_v2: classInfo.expected_escalation_target_v2,
      criterion: classInfo.criterion,
      criteria: classInfo.criteria,
      requires_action: classInfo.requires_action,
      requires_context: classInfo.requires_context,
      context_fixture: evalContext.eval_context_fixture || null,
      tier: tierName,
      ...result,
    });
    const icon = pass ? '✓' : '✗';
    const latency = result.latency_ms ? `${result.latency_ms}ms` : 'n/a';
    console.log(`  ${icon} ${q.id}: "${q.query}" [${latency}]`);
  }

  const scored = results.filter((r) => !r.excluded);
  const passed = scored.filter((r) => r.pass).length;
  const failed = scored.length - passed;
  const excludedCount = excludedActionIds.length + excludedContextIds.length;
  if (tierName === 'classifier') {
    console.log(`\n  Result: ${passed}/${results.length} passed`);
  } else {
    console.log(
      `\n  Result: ${passed} passed, ${failed} failed, ${excludedCount} excluded ` +
        `(${excludedActionIds.length} require action, ${excludedContextIds.length} require context — see findings/2026-05-10-simple-intents-tool-gap.md)`
    );
  }

  return {
    tier: tierName,
    suite: suiteName,
    timestamp: new Date().toISOString(),
    ...(environment ? { environment } : {}),
    ...(tierName === 'classifier' ? {} : { eval_max_tokens: DEFAULT_EVAL_MAX_TOKENS, reps: options.reps || 1 }),
    total: results.length,
    passed,
    failed,
    ...(tierName === 'classifier'
      ? {}
      : {
          excluded_count: excludedCount,
          excluded_action_ids: excludedActionIds,
          excluded_context_ids: excludedContextIds,
        }),
    results,
  };
}

async function runCompareSuite(suiteName, environment = null, options = {}) {
  const queries = loadSuite(suiteName);
  const expected = loadExpected();
  const results = [];
  const excludedActionIds = [];
  const excludedContextIds = [];
  const compareTiers = options.includeGroq ? ['local', 'groq', 'anthropic-sonnet'] : COMPARE_TIERS;
  const effectiveCompareTiers = suiteName === 'knowledge' ? ['knowledge-bridge'] : compareTiers;

  console.log(`\nRunning compare mode on ${suiteName} (${queries.length} queries)...`);

  for (const q of queries) {
    const routeInfo = classifyForEval(q.query);
    const { classification } = routeInfo;
    const classInfo = scoreClassification(q, expected);
    const exclusionReason = shouldExclude(classInfo, options);
    if (exclusionReason) {
      if (exclusionReason === 'requires_action') excludedActionIds.push(q.id);
      if (exclusionReason === 'requires_context') excludedContextIds.push(q.id);
      results.push({
        id: q.id,
        query: q.query,
        criterion: classInfo.criterion,
        criteria: classInfo.criteria,
        classification,
        escalation_target: routeInfo.escalation_target,
        expected_classification: classInfo.expected_classification,
        expected_classification_v2: classInfo.expected_classification_v2,
        expected_escalation_target_v2: classInfo.expected_escalation_target_v2,
        requires_action: classInfo.requires_action,
        requires_context: classInfo.requires_context,
        excluded: true,
        exclusion_reason: exclusionReason,
        tiers: {},
        cheapest_passing_tier: null,
      });
      console.log(`  - ${q.id}: "${q.query}" excluded (${exclusionReason})`);
      continue;
    }

    const tiers = {};
    for (const tier of effectiveCompareTiers) {
      const evalContext = buildEvalContext(q, classInfo, options);
      const result = await runTierQueryReps(tier, q.query, evalContext, classInfo.criteria, options.reps || 1);
      tiers[tier] = {
        ...result,
        context_fixture: evalContext.eval_context_fixture || null,
      };
    }

    const cheapest = cheapestPassingTier(tiers);
    results.push({
      id: q.id,
      query: q.query,
      criterion: classInfo.criterion,
      criteria: classInfo.criteria,
      classification,
      escalation_target: routeInfo.escalation_target,
      expected_classification: classInfo.expected_classification,
      expected_classification_v2: classInfo.expected_classification_v2,
      expected_escalation_target_v2: classInfo.expected_escalation_target_v2,
      requires_action: classInfo.requires_action,
      requires_context: classInfo.requires_context,
      tiers,
      cheapest_passing_tier: cheapest,
    });
    console.log(`  ${cheapest ? '✓' : '✗'} ${q.id}: "${q.query}" cheapest passing tier: ${cheapest || 'none'}`);
  }

  const included = results.filter((r) => !r.excluded);
  const passByAnyTier = included.filter((r) => r.cheapest_passing_tier).length;
  const excludedCount = excludedActionIds.length + excludedContextIds.length;

  return {
    mode: 'compare',
    suite: suiteName,
    timestamp: new Date().toISOString(),
    ...(environment ? { environment } : {}),
    eval_max_tokens: DEFAULT_EVAL_MAX_TOKENS,
    reps: options.reps || 1,
    tiers_compared: effectiveCompareTiers,
    total: results.length,
    compared_count: included.length,
    pass_by_any_tier: passByAnyTier,
    failed_all_tiers: included.length - passByAnyTier,
    excluded_count: excludedCount,
    excluded_action_ids: excludedActionIds,
    excluded_context_ids: excludedContextIds,
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

function saveCompareResult(evalResult) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-compare-${evalResult.suite}.json`;
  const path = join(RESULTS_DIR, filename);
  writeFileSync(path, JSON.stringify(evalResult, null, 2));
  console.log(`  Saved: ${path}`);
}

function printJudgeSummary() {
  const stats = getJudgeStats();
  console.log('\nJudge summary:');
  console.log(`  total queries judged: ${stats.total}`);
  console.log(`  deterministic judgments: ${stats.deterministic}`);
  console.log(`  LLM judgments: ${stats.llm}`);
  console.log(`  judge cache hits: ${stats.cacheHits}`);
  console.log(`  new judgments: ${stats.newJudgments}`);
  console.log(`  estimated judge cost: $${stats.estimatedCostUsd.toFixed(6)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const tierIdx = args.lastIndexOf('--tier');
  const suiteIdx = args.lastIndexOf('--suite');
  const modeIdx = args.lastIndexOf('--mode');
  const repsIdx = args.lastIndexOf('--reps');

  const tierArg = tierIdx >= 0 ? args[tierIdx + 1] : 'classifier';
  const suiteArg = suiteIdx >= 0 ? args[suiteIdx + 1] : 'all';
  const mode = tierArg === 'compare' ? 'compare' : (modeIdx >= 0 ? args[modeIdx + 1] : 'score');
  const repsGiven = repsIdx >= 0;
  const parsedReps = repsGiven ? Number.parseInt(args[repsIdx + 1], 10) : NaN;
  const reps = repsGiven
    ? (Number.isFinite(parsedReps) && parsedReps > 0 ? parsedReps : 1)
    : (mode === 'compare' ? 3 : 1);
  const includeAction = args.includes('--include-action');
  const includeContext = args.includes('--include-context');
  const includeGroq = args.includes('--include-groq');
  const withKnowledge = args.includes('--with-knowledge');

  const tiersToRun = tierArg === 'compare'
    ? []
    : (tierArg === 'all'
        ? ['classifier', ...TIERS, ...(withKnowledge ? EXTRA_TIERS : [])]
        : [tierArg]);
  const suitesToRun = suiteArg === 'all' ? [...SUITES, ...(withKnowledge ? EXTRA_SUITES : [])] : [suiteArg];
  const runEnvironmentCheck = mode === 'compare' || tiersToRun.some((tier) => tier !== 'classifier');
  const environment = runEnvironmentCheck ? await captureEnvironment() : null;
  resetJudgeStats();

  if (environment) {
    printEnvironmentDiff(environment);
    if (environment.drift_detected) {
      console.warn('\nEnvironment drift detected; continuing because eval runner uses warn-only mode.');
    }
  }

  if (mode === 'compare') {
    for (const suite of suitesToRun) {
      const result = await runCompareSuite(suite, environment, {
        includeAction,
        includeContext,
        includeGroq,
        reps,
      });
      saveCompareResult(result);
    }
  } else {
    for (const tier of tiersToRun) {
      for (const suite of suitesToRun) {
      const result = await runSuite(tier, suite, tier === 'classifier' ? null : environment, {
        includeAction,
        includeContext,
        includeGroq,
        reps,
      });
      saveResult(result);
      }
    }
  }

  if (runEnvironmentCheck) {
    printJudgeSummary();
  }
}

main().catch((err) => {
  console.error('Eval error:', err);
  process.exit(1);
});
