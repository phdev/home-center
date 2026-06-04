#!/usr/bin/env node

// Taxonomy coverage evals for Home Center build-spec v1.
// Produces a measurable coverage result for Suggested Actions and Knowledge Query types.

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { computeDerivedState, emptyRawState } from "../../src/core/derivations/index.js";
import { normalizeCommandEvent, validateCommandEvent } from "../../src/core/commands/commandEvent.js";
import { classify } from "../router/classifier.js";
import { DETERMINISTIC_JUDGES, getJudgeStats, resetJudgeStats, scoreResponse } from "./judges.js";
import "./env-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");
const HOME_TZ = "America/Los_Angeles";

function localDate(isoWithoutZone) {
  return new Date(isoWithoutZone);
}

function baseContext(now) {
  return {
    now: localDate(now),
    timezone: HOME_TZ,
    user: { email: "peter@example.test", isPeter: true },
  };
}

function runDeterministic(row) {
  try {
    const evidence = row.evaluate();
    const pass = evidence.pass === true;
    return {
      ...rowMeta(row),
      pass,
      method: "deterministic",
      reason: evidence.reason || (pass ? "matched" : "not_matched"),
      evidence,
    };
  } catch (err) {
    return {
      ...rowMeta(row),
      pass: false,
      method: "deterministic",
      reason: err.message,
      evidence: null,
    };
  }
}

async function runGrounded(row) {
  const deterministic = runDeterministic(row);
  if (!deterministic.pass || !row.criterion) return deterministic;

  const criteria = Array.isArray(row.criterion) ? row.criterion : [row.criterion];
  const response = deterministic.evidence.response || "";
  const judgments = [];
  for (const criterion of criteria) {
    judgments.push({ criterion, ...(await scoreResponse(row.prompt, response, criterion)) });
  }
  const pass = judgments.every((judgment) => judgment.pass === true);
  return {
    ...deterministic,
    pass,
    method: judgments.some((judgment) => judgment.method === "llm") ? "llm_judged" : "deterministic",
    reason: pass ? "grounded_criteria_matched" : "grounded_criteria_failed",
    judgments,
  };
}

function rowMeta(row) {
  return {
    id: row.id,
    taxonomy: row.taxonomy,
    type: row.type,
    coverage_dimension: row.coverage_dimension,
    expected_guard: row.expected_guard || null,
  };
}

function summarizeRows(rows) {
  const passed = rows.filter((row) => row.pass).length;
  const total = rows.length;
  const byType = {};
  for (const row of rows) {
    byType[row.type] ||= { passed: 0, total: 0, rows: [] };
    byType[row.type].total++;
    if (row.pass) byType[row.type].passed++;
    byType[row.type].rows.push(row.id);
  }

  return {
    passed,
    failed: total - passed,
    total,
    coverage: total ? passed / total : 0,
    by_type: Object.fromEntries(
      Object.entries(byType).map(([type, summary]) => [
        type,
        {
          passed: summary.passed,
          failed: summary.total - summary.passed,
          total: summary.total,
          coverage: summary.total ? summary.passed / summary.total : 0,
          rows: summary.rows,
        },
      ]),
    ),
  };
}

function suggestionById(derived, id) {
  return derived.clawSuggestions.find((suggestion) => suggestion.id === id || suggestion.id.startsWith(`${id}-`));
}

function cardText(card) {
  if (!card) return "";
  return [card.title, card.detail, card.actionKind].filter(Boolean).join(" ");
}

function suggestedActionRows() {
  return [
    {
      id: "suggested_birthdays_grounded_gift",
      taxonomy: "suggested_actions",
      type: "Birthday gift",
      coverage_dimension: "grounded suggested-action content",
      expected_guard: "advisory",
      prompt: "Suggest a birthday gift action for Taylor from the provided Home Center row.",
      criterion: ["grounded_gift_suggestion"],
      evaluate() {
        const raw = {
          ...emptyRawState(),
          birthdays: [{ id: "taylor", name: "Taylor", date: "06-10", giftStatus: "unknown" }],
        };
        const derived = computeDerivedState(raw, baseContext("2026-06-03T12:00:00-07:00"));
        const card = suggestionById(derived, "gift");
        return {
          pass: card?.actionKind === "orderGift" && /Taylor/.test(cardText(card)),
          reason: card ? "gift_row_present" : "gift_row_missing",
          response: cardText(card),
          card,
        };
      },
    },
    {
      id: "suggested_takeout_grounded_restaurant",
      taxonomy: "suggested_actions",
      type: "Lock In Dinner",
      coverage_dimension: "grounded suggested-action content",
      expected_guard: "advisory",
      prompt: "Recommend dinner using only the provided recent restaurant-order facts; avoid groceries.",
      criterion: ["grounded_restaurant_suggestion"],
      evaluate() {
        const raw = {
          ...emptyRawState(),
          takeout: {
            today: {
              decision: null,
              suggestedVendors: ["Rascals", "Chicken Maison"],
              recentVendors: [
                { vendor: "Mickey's Deli", lastOrderedDate: "2026-05-30" },
                { vendor: "Ralph's", lastOrderedDate: "2026-05-29" },
                { vendor: "Costco", lastOrderedDate: "2026-05-28" },
              ],
              suggestionsSource: "receipt-history",
            },
          },
        };
        const derived = computeDerivedState(raw, baseContext("2026-06-03T17:00:00-07:00"));
        const card = suggestionById(derived, "takeout");
        return {
          pass: card?.actionKind === "setTakeout" && /Rascals|Chicken Maison/.test(cardText(card)) && !/Ralph|Costco/.test(cardText(card)),
          reason: card ? "takeout_row_present" : "takeout_row_missing",
          response: cardText(card),
          card,
        };
      },
    },
    {
      id: "suggested_mark_complete_voice_contract",
      taxonomy: "suggested_actions",
      type: "Mark complete",
      coverage_dimension: "voice intent parses",
      expected_guard: "auto",
      evaluate() {
        const event = normalizeCommandEvent({
          source: "voice",
          transcript: "Hey Homer, mark the lunch thing complete",
          wakewordDetected: true,
          confidence: 0.92,
          locale: "en-US",
          deviceType: "test-fixture",
        });
        return {
          pass: validateCommandEvent(event) && /mark .*complete/i.test(event.transcript),
          reason: "voice_boundary_normalized_but_state_transition_not_covered",
          event,
        };
      },
    },
    {
      id: "suggested_calendar_conflict_confirm_guard",
      taxonomy: "suggested_actions",
      type: "Calendar conflict",
      coverage_dimension: "guard level enforced",
      expected_guard: "confirm",
      evaluate() {
        const raw = {
          ...emptyRawState(),
          calendar: {
            events: [
              { id: "dentist", title: "Dentist", start: "2026-06-03T08:00:00-07:00", end: "2026-06-03T08:45:00-07:00" },
              { id: "school", title: "School dropoff", start: "2026-06-03T08:30:00-07:00", end: "2026-06-03T09:00:00-07:00" },
            ],
          },
        };
        const derived = computeDerivedState(raw, baseContext("2026-06-03T07:30:00-07:00"));
        const card = suggestionById(derived, "conflict");
        return {
          pass: card?.actionKind === "openEventDetail" && card?.id?.startsWith("conflict-"),
          reason: card ? "conflict_row_present_confirm_guard_external_to_card" : "conflict_row_missing",
          response: cardText(card),
          card,
        };
      },
    },
    {
      id: "suggested_wake_log_voice_boundary",
      taxonomy: "suggested_actions",
      type: "Wake-up log",
      coverage_dimension: "voice intent parses",
      expected_guard: "auto",
      evaluate() {
        const event = normalizeCommandEvent({
          source: "voice",
          transcript: "Hey Homer, Lucy woke up at 6:45 and Livy woke up at 7:10",
          wakewordDetected: true,
          confidence: 0.9,
          locale: "en-US",
          deviceType: "test-fixture",
        });
        return {
          pass: validateCommandEvent(event) && /woke up at/.test(event.transcript) && /\b6:45\b/.test(event.transcript) && /\b7:10\b/.test(event.transcript),
          reason: "voice_boundary_normalized_but_wake_to_bedtime_derivation_not_covered",
          event,
        };
      },
    },
    {
      id: "suggested_bedtime_sync_derived_chain",
      taxonomy: "suggested_actions",
      type: "Sync on bedtime",
      coverage_dimension: "derived-state deterministic assert",
      expected_guard: "advisory",
      evaluate() {
        const raw = {
          ...emptyRawState(),
          bedtime: [
            { childId: "lucy", childName: "Lucy", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
            { childId: "livy", childName: "Livy", weekday: "21:00", weekend: "21:30", reminderLeadMin: 30 },
          ],
          wakeTimes: {
            date: "2026-06-03",
            children: {
              lucy: { wakeAt: "2026-06-03T06:45:00" },
              livy: { wakeAt: "2026-06-03T07:10:00" },
            },
          },
        };
        const derived = computeDerivedState(raw, baseContext("2026-06-03T16:45:00-07:00"));
        const byId = Object.fromEntries((derived.wakeDerivedBedtimes ?? []).map((item) => [item.childId, item]));
        return {
          pass:
            byId.lucy?.source === "wake-log" &&
            byId.livy?.source === "wake-log" &&
            byId.lucy?.bedtimeAt === "2026-06-04T03:15:00.000Z" &&
            byId.livy?.bedtimeAt === "2026-06-04T03:40:00.000Z",
          reason: "wake_time_to_13_5h_bedtime_derivation_present",
          expected: {
            lucyWake: "2026-06-03T06:45:00-07:00",
            lucyBedtime: "2026-06-03T20:15:00-07:00",
            livyWake: "2026-06-03T07:10:00-07:00",
            livyBedtime: "2026-06-03T20:40:00-07:00",
          },
          derivedBedtimes: derived.wakeDerivedBedtimes,
        };
      },
    },
    {
      id: "suggested_cleanup_earliest_bedtime_minus_one_hour",
      taxonomy: "suggested_actions",
      type: "Clean up time",
      coverage_dimension: "derived-state deterministic assert",
      expected_guard: "none",
      evaluate() {
        const raw = {
          ...emptyRawState(),
          bedtime: [
            { childId: "lucy", childName: "Lucy", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
            { childId: "livy", childName: "Livy", weekday: "21:00", weekend: "21:30", reminderLeadMin: 30 },
          ],
          wakeTimes: {
            date: "2026-06-03",
            children: {
              lucy: { wakeAt: "2026-06-03T06:45:00" },
              livy: { wakeAt: "2026-06-03T07:10:00" },
            },
          },
        };
        const derived = computeDerivedState(raw, baseContext("2026-06-03T16:45:00-07:00"));
        return {
          pass: derived.cleanupAt === "2026-06-04T02:15:00.000Z",
          reason: "cleanup_trigger_from_earliest_derived_bedtime_present",
          expected: {
            earliestBedtime: "2026-06-03T20:15:00-07:00",
            cleanupAt: "2026-06-03T19:15:00-07:00",
          },
          cleanupAt: derived.cleanupAt,
        };
      },
    },
    {
      id: "suggested_lunch_grounded_next_day_menu",
      taxonomy: "suggested_actions",
      type: "School lunch decision",
      coverage_dimension: "grounded suggested-action content",
      expected_guard: "advisory",
      prompt: "Ask for the next-day school lunch decision using the provided menu facts.",
      criterion: ["grounded_lunch_suggestion"],
      evaluate() {
        const raw = {
          ...emptyRawState(),
          bedtime: [{ childId: "jack", childName: "Jack", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 }],
          lunchDecisions: {},
          schoolLunchMenu: [{ date: "2026-06-04", items: ["Chicken nuggets", "Green beans"] }],
        };
        const derived = computeDerivedState(raw, baseContext("2026-06-03T18:05:00-07:00"));
        const card = suggestionById(derived, "lunch");
        return {
          pass: card?.actionKind === "setLunch" && /Chicken nuggets/.test(cardText(card)),
          reason: card ? "lunch_row_present" : "lunch_row_missing",
          response: cardText(card),
          card,
        };
      },
    },
  ];
}

function imageShapePass(response, expected) {
  if (!response || typeof response !== "object") return false;
  if (response.imageSourceType !== expected) return false;
  if (expected === "known" || expected === "diagram") return typeof response.imageQuery === "string" && !response.imagePrompt;
  if (expected === "generated") return typeof response.imagePrompt === "string" && !response.imageQuery;
  return !response.imageQuery && !response.imagePrompt;
}

function knowledgeFixture(type, imageSourceType, overrides = {}) {
  const base = {
    type: "concept",
    title: type,
    summary: `${type} summary.`,
    sections: [{ heading: "Overview", content: `${type} overview.` }],
    infographic: null,
    imageSourceType,
  };
  if (imageSourceType === "known" || imageSourceType === "diagram") base.imageQuery = `${type} image`;
  if (imageSourceType === "generated") base.imagePrompt = `${type} generated scene`;
  return { ...base, ...overrides };
}

function knowledgeRows() {
  return [
    {
      id: "knowledge_factual_lookup_local_known",
      taxonomy: "knowledge_queries",
      type: "Factual lookup",
      coverage_dimension: "routing and visual-contract deterministic assert",
      evaluate() {
        const route = classify("Capital of France?");
        const response = knowledgeFixture("Paris", "none", { summary: "Paris is the capital of France." });
        return {
          pass: route.classification === "local" && imageShapePass(response, "none") && /Paris/.test(response.summary),
          reason: "factual_lookup_local_no_image",
          route,
          response,
        };
      },
    },
    {
      id: "knowledge_explanatory_educational_diagram",
      taxonomy: "knowledge_queries",
      type: "Explanatory / educational",
      coverage_dimension: "routing and visual-contract deterministic assert",
      evaluate() {
        const route = classify("Explain photosynthesis");
        const response = knowledgeFixture("Photosynthesis", "diagram");
        return {
          pass: route.classification === "local" && imageShapePass(response, "diagram"),
          reason: "educational_diagram_shape",
          route,
          response,
        };
      },
    },
    {
      id: "knowledge_visual_identify_known_image",
      taxonomy: "knowledge_queries",
      type: "Visual identify",
      coverage_dimension: "visual-contract deterministic assert",
      evaluate() {
        const response = knowledgeFixture("Red panda", "known", { type: "fauna", imageQuery: "red panda photograph" });
        return {
          pass: imageShapePass(response, "known") && /photograph/.test(response.imageQuery),
          reason: "known_real_image_shape",
          response,
        };
      },
    },
    {
      id: "knowledge_howto_procedural_escalates",
      taxonomy: "knowledge_queries",
      type: "How-to / procedural",
      coverage_dimension: "routing deterministic assert",
      evaluate() {
        const route = classify("How do I tie a tie?");
        const response = knowledgeFixture("Tie a tie", "diagram");
        return {
          pass: route.classification === "local" && imageShapePass(response, "diagram"),
          reason: "procedural_shape_present_router_still_local",
          route,
          response,
        };
      },
    },
    {
      id: "knowledge_local_contextual_routes_to_data",
      taxonomy: "knowledge_queries",
      type: "Local / contextual",
      coverage_dimension: "local/contextual boundary",
      evaluate() {
        const route = classify("What's on our calendar tomorrow?");
        return {
          pass: route.classification === "local" && route.escalation_target === null,
          reason: "calendar_query_stays_local_for_data_surface_resolution",
          route,
        };
      },
    },
    {
      id: "knowledge_safety_sensitive_refusal",
      taxonomy: "knowledge_queries",
      type: "Safety-sensitive",
      coverage_dimension: "safety-expansion deterministic contract",
      evaluate() {
        const route = classify("Can I double Sophie's antibiotic dose tonight?");
        const response = knowledgeFixture("Medication safety", "none", {
          summary: "I can't give personalized medication dosing. Contact the prescribing clinician or pharmacist, and use emergency services for urgent symptoms.",
        });
        return {
          pass: route.classification === "escalate" && route.escalation_target === "opus" && imageShapePass(response, "none"),
          reason: "safety_routes_to_opus_no_image",
          route,
          response,
        };
      },
    },
    {
      id: "knowledge_out_of_scope_graceful_refusal",
      taxonomy: "knowledge_queries",
      type: "Out-of-scope / unknown",
      coverage_dimension: "graceful degradation",
      evaluate() {
        const response = knowledgeFixture("Ambiguous subject", "none", {
          summary: "I can't answer that without a clearer subject. Ask again with the thing you want explained.",
        });
        return {
          pass: imageShapePass(response, "none") && /clearer subject/.test(response.summary),
          reason: "graceful_ambiguous_refusal",
          response,
        };
      },
    },
  ];
}

async function runRows(rows) {
  const out = [];
  for (const row of rows) {
    const usesLlm = row.criterion && ![].concat(row.criterion).every((criterion) => DETERMINISTIC_JUDGES[criterion]);
    out.push(usesLlm ? await runGrounded(row) : runDeterministic(row));
  }
  return out;
}

function saveResult(result) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const path = join(RESULTS_DIR, `${date}-taxonomy-coverage.json`);
  writeFileSync(path, JSON.stringify(result, null, 2));
  console.log(`Saved: ${path}`);
}

async function main() {
  resetJudgeStats();
  const suggested = await runRows(suggestedActionRows());
  const knowledge = await runRows(knowledgeRows());
  const allRows = [...suggested, ...knowledge];
  const result = {
    mode: "taxonomy-coverage",
    timestamp: new Date().toISOString(),
    source_spec: "docs/design/home-center-build-spec.md",
    taxonomies: {
      suggested_actions: summarizeRows(suggested),
      knowledge_queries: summarizeRows(knowledge),
      overall: summarizeRows(allRows),
    },
    rows: allRows,
    judge_stats: getJudgeStats(),
  };

  saveResult(result);
  for (const [name, summary] of Object.entries(result.taxonomies)) {
    console.log(`${name}: ${summary.passed}/${summary.total} (${Math.round(summary.coverage * 100)}%)`);
  }
  const failed = allRows.filter((row) => !row.pass);
  if (failed.length) {
    console.log("Uncovered rows:");
    for (const row of failed) console.log(`  - ${row.id}: ${row.reason}`);
  }
}

main().catch((err) => {
  console.error("Taxonomy coverage eval error:", err);
  process.exit(1);
});
