#!/usr/bin/env node
import worker from "../worker/src/index.js";

const CASES = [
  {
    query: "What is the internet?",
    type: "concept",
    title: "The Internet",
    subType: "concept/network",
    pattern: "abstract-concept-orbital",
    heroMode: "fallback",
    heroModule: "native-concept-hero",
    middle: "process-flow",
    lower: "icon-metric-columns",
    imageSourceType: "none",
  },
  {
    query: "Where is Madagascar?",
    type: "location",
    title: "Madagascar",
    subType: "location/island",
    pattern: "place-scenic-wide",
    heroMode: "pinned",
    heroModule: "scenic-location",
    middle: "world-map-pin",
    lower: "island-shape-stats",
    imageSourceType: "known",
    imageMustInclude: /baobab|madagascar/i,
    imageMustNotInclude: /bird|ibis|animal/i,
  },
  {
    query: "Who was Ada Lovelace?",
    type: "person",
    title: "Ada Lovelace",
    subType: "person/historical-scientist",
    pattern: "portrait-right-text-left",
    heroMode: "pinned",
    heroModule: "portrait-editorial",
    middle: "vertical-timeline",
    lower: "icon-metric-columns",
    imageSourceType: "known",
  },
  {
    query: "Tell me about emperor penguins.",
    type: "fauna",
    title: "Emperor Penguin",
    subType: "fauna/polar-animal",
    pattern: "species-closeup-with-environment",
    heroMode: "pinned",
    heroModule: "species-closeup-with-environment",
    middle: "habitat-range",
    lower: "lifecycle-loop",
    imageSourceType: "known",
    minFacts: 2,
  },
  {
    query: "Tell me about coast redwood trees.",
    type: "flora",
    title: "Coast Redwood",
    subType: "flora/tree",
    pattern: "tall-subject-forest-depth",
    heroMode: "pinned",
    heroModule: "scenic-location",
    middle: "range-glass",
    lower: "height-comparison",
    imageSourceType: "known",
  },
  {
    query: "What happened during Apollo 11?",
    type: "event",
    title: "Apollo 11 Moon Landing",
    subType: "event/space-mission",
    pattern: "archival-event-scene",
    heroMode: "pinned",
    heroModule: "archival-event-scene",
    middle: "us-places-map",
    lower: "horizontal-mission-timeline",
    imageSourceType: "known",
  },
];

const ANSWERS = new Map(CASES.map((item) => [item.query, {
  type: item.type,
  title: item.title,
  summary: `${item.title} has a concise complete hero claim. Supporting details stay in native cards and the insight panel.`,
  sections: [
    { heading: "Overview", content: `${item.title} overview with context for the lower insight card.` },
  ],
  profile: {
    facts: [
      { label: "Type", value: item.type },
      { label: "Focus", value: item.title },
      { label: "Style", value: "Reference" },
      { label: "Mode", value: item.heroMode },
    ],
    maps: item.type === "concept" || item.type === "person" ? [] : [
      { scope: "world", label: item.title, highlight: item.title, lat: -18.8, lon: 46.8 },
    ],
    relatedConcepts: ["context", "timeline", "systems"],
  },
  timeline: [
    { date: "01", label: "Origin", description: "Reference-density item." },
    { date: "02", label: "Shift", description: "Reference-density item." },
  ],
  infographic: {
    title: item.type === "concept" ? "Concept Map" : "At a Glance",
    kind: "metrics",
    description: "Compact reference-style metrics.",
    items: [
      { label: "Signal", value: "High" },
      { label: "Density", value: "Rich" },
      { label: "Native", value: "React/SVG" },
    ],
  },
  infographics: [{
    title: item.type === "concept" ? "Concept Map" : "At a Glance",
    kind: "metrics",
    description: "Compact reference-style metrics.",
    items: [
      { label: "Signal", value: "High" },
      { label: "Density", value: "Rich" },
      { label: "Native", value: "React/SVG" },
    ],
  }],
  visualNeed: item.imageSourceType === "none" ? "none" : "useful",
  imageSourceType: item.imageSourceType,
  imageQuery: item.imageSourceType === "none" ? null : `${item.title} editorial reference visual`,
}]));

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createKv() {
  const store = new Map();
  return {
    get: async (key, options = {}) => {
      const value = store.get(key);
      if (value == null) return null;
      return options.type === "json" ? JSON.parse(value) : value;
    },
    put: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
  };
}

function installMockFetch() {
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.startsWith("https://bridge.test")) {
      const answer = ANSWERS.get(globalThis.__referenceFidelityQuery);
      const count = (globalThis.__referenceFidelityBridgeCalls = (globalThis.__referenceFidelityBridgeCalls || 0) + 1);
      const isClassification = count % 2 === 1;
      return jsonResponse({
        json: isClassification ? {
          type: answer.type,
          title: answer.title,
          visualNeed: answer.visualNeed,
          spaceScience: answer.type === "event",
          entityQuery: answer.title,
          visualSearchQuery: answer.imageQuery || answer.title,
        } : answer,
        model: "mock",
        log_row_id: `reference-fidelity-${count}`,
      });
    }
    if (href.startsWith("https://commons.wikimedia.org/w/api.php")) {
      return jsonResponse({ query: { pages: {} } });
    }
    if (href.startsWith("https://en.wikipedia.org/")) {
      return jsonResponse({ pages: [] });
    }
    if (href.startsWith("https://images-api.nasa.gov/")) {
      return jsonResponse({ collection: { items: [] } });
    }
    throw new Error(`Unexpected mock fetch: ${href}`);
  };
}

async function ask(query) {
  globalThis.__referenceFidelityQuery = query;
  const response = await worker.fetch(new Request("https://worker.test/api/ask-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  }), {
    NOTIFICATIONS: createKv(),
    OPENAI_API_KEY: "mock-key",
    KNOWLEDGE_TEXT_BRIDGE_URL: "https://bridge.test",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function fail(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validate(item, body) {
  const failures = [];
  fail(body.type === item.type, `expected type ${item.type}, got ${body.type}`, failures);
  fail(body.title === item.title, `expected title ${item.title}, got ${body.title}`, failures);
  fail(body.visualPlan?.subType === item.subType, `expected subtype ${item.subType}, got ${body.visualPlan?.subType}`, failures);
  fail(body.visualPlan?.compositionPattern === item.pattern, `expected pattern ${item.pattern}, got ${body.visualPlan?.compositionPattern}`, failures);
  fail(body.heroComposition?.mode === item.heroMode, `expected hero mode ${item.heroMode}, got ${body.heroComposition?.mode}`, failures);
  fail(body.visualPlan?.moduleStyles?.hero === item.heroModule, `expected hero module ${item.heroModule}`, failures);
  fail(body.visualPlan?.moduleStyles?.middle === item.middle, `expected middle module ${item.middle}`, failures);
  fail(body.visualPlan?.moduleStyles?.lower === item.lower, `expected lower module ${item.lower}`, failures);
  fail(body.visualPlan?.moduleStyles?.facts === "compact-fact-rows", "expected compact fact rows", failures);
  fail(Array.isArray(body.profile?.facts) && body.profile.facts.length >= (item.minFacts || 3), "expected dense key facts", failures);
  fail(Array.isArray(body.profile?.relatedConcepts) && body.profile.relatedConcepts.length >= 3, "expected related chips", failures);
  fail(!/\.{3}|…/.test(body.summary || ""), "primary summary contains ellipsis", failures);
  if (item.type === "concept") {
    fail(!body.imageUrl, "concept page should use native visual instead of raw hero image", failures);
    fail(body.visualPlan?.heroStrategy === "abstract-concept", "concept page should use abstract concept strategy", failures);
  } else {
    fail(body.imageUrl, "expected pinned hero image", failures);
    fail(body.curatedAsset?.mode === "pinned", "expected canonical pinned asset", failures);
  }
  if (item.imageMustInclude) {
    fail(item.imageMustInclude.test(`${body.imageUrl} ${body.image?.sourceUrl}`), "expected scenic/location hero URL metadata", failures);
  }
  if (item.imageMustNotInclude) {
    fail(!item.imageMustNotInclude.test(`${body.imageUrl} ${body.image?.sourceUrl}`), "hero URL metadata contains rejected animal/bird terms", failures);
  }
  return failures;
}

installMockFetch();
const rows = [];
let failed = false;
for (const item of CASES) {
  try {
    const body = await ask(item.query);
    const failures = validate(item, body);
    failed ||= failures.length > 0;
    rows.push({
      query: item.query,
      type: body.type,
      heroMode: body.heroComposition?.mode,
      pattern: body.visualPlan?.compositionPattern,
      modules: Object.values(body.visualPlan?.moduleStyles || {}).join(" / "),
      result: failures.length ? `FAIL: ${failures.join("; ")}` : "PASS",
    });
  } catch (error) {
    failed = true;
    rows.push({ query: item.query, result: `FAIL: ${error.message}` });
  }
}

console.table(rows);
if (failed) process.exit(1);
