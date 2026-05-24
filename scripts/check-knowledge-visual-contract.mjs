#!/usr/bin/env node
import worker from "../worker/src/index.js";

const QUERIES = [
  "Where is Madagascar?",
  "Where is Iceland?",
  "Where is the smallest country in the world?",
  "Who was Ada Lovelace?",
  "Who was Marie Curie?",
  "Who invented the World Wide Web?",
  "Tell me about emperor penguins.",
  "Tell me about blue whales.",
  "Tell me about coast redwoods.",
  "Tell me about Venus flytraps.",
  "Tell me about tardigrades.",
  "What happened during Apollo 11?",
  "What is photosynthesis?",
  "What is quantum entanglement?",
];

const args = new Set(process.argv.slice(2));
const live = args.has("--live");

const FIXTURES = new Map([
  ["Where is Madagascar?", ["location", "Madagascar", "known", "Madagascar map", "https://wiki.test/madagascar.jpg"]],
  ["Where is Iceland?", ["location", "Iceland", "known", "Iceland map", "https://wiki.test/iceland.jpg"]],
  ["Where is the smallest country in the world?", ["location", "Vatican City", "known", "Vatican City map", "https://wiki.test/vatican.jpg"]],
  ["Who was Ada Lovelace?", ["person", "Ada Lovelace", "known", "Ada Lovelace portrait", "https://wiki.test/ada.jpg"]],
  ["Who was Marie Curie?", ["person", "Marie Curie", "known", "Marie Curie portrait", "https://wiki.test/curie.jpg"]],
  ["Who invented the World Wide Web?", ["person", "Tim Berners-Lee", "known", "Tim Berners-Lee portrait", "https://wiki.test/tim.jpg"]],
  ["Tell me about emperor penguins.", ["fauna", "Emperor Penguin", "known", "Emperor Penguin photo", "https://wiki.test/penguin.jpg"]],
  ["Tell me about blue whales.", ["fauna", "Blue Whale", "known", "Blue Whale photo", "https://wiki.test/whale.jpg"]],
  ["Tell me about coast redwoods.", ["flora", "Coast redwoods", "known", "Coast redwoods forest", "https://wiki.test/redwood.jpg"]],
  ["Tell me about Venus flytraps.", ["flora", "Venus flytrap", "known", "Venus flytrap close-up", "https://wiki.test/flytrap.jpg"]],
  ["Tell me about tardigrades.", ["fauna", "Tardigrades", "known", "Tardigrades microscope", "https://wiki.test/tardigrade.jpg"]],
  ["What happened during Apollo 11?", ["event", "Apollo 11 Moon Landing", "known", "Apollo 11 NASA archival photo", "https://nasa.test/apollo.jpg"]],
  ["What is photosynthesis?", ["concept", "Photosynthesis", "diagram", "photosynthesis process diagram", null]],
  ["What is quantum entanglement?", ["concept", "Quantum entanglement", "none", "", null]],
]);

function usage() {
  console.error("Usage: npm run check:knowledge-visual-contract [-- --live]");
  console.error("Live mode requires WORKER_TOKEN and optionally WORKER_URL.");
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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installMockFetch() {
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.startsWith("https://bridge.test")) {
      const fixture = FIXTURES.get(globalThis.__lastKnowledgeQuery);
      const [type, title, imageSourceType, imageQuery] = fixture || ["concept", "Fallback", "none", ""];
      const bridgeCalls = (globalThis.__bridgeCalls = (globalThis.__bridgeCalls || 0) + 1);
      const isClassification = bridgeCalls % 2 === 1;
      return jsonResponse({
        json: isClassification
          ? {
              type,
              title,
              visualNeed: imageSourceType === "none" ? "none" : "useful",
              spaceScience: /Apollo 11/i.test(title),
              entityQuery: title,
              visualSearchQuery: imageQuery || title,
            }
          : {
              type,
              title,
              summary: `${title} summary.`,
              sections: [{ heading: "Overview", content: `${title} overview.` }],
              profile: { facts: [{ label: "Known for", value: title }], maps: [], relatedConcepts: ["history", "context"] },
              visualNeed: imageSourceType === "none" ? "none" : "useful",
              imageSourceType,
              ...(imageQuery ? { imageQuery } : {}),
            },
        model: "mock",
        log_row_id: `mock-${bridgeCalls}`,
      });
    }
    if (href.startsWith("https://images-api.nasa.gov/search")) {
      return jsonResponse({
        collection: {
          items: [{
            href: "https://images.nasa.gov/details/APOLLO11",
            data: [{ title: "Apollo 11", description: "Apollo 11 Moon landing.", nasa_id: "APOLLO11", center: "NASA" }],
            links: [{ href: "https://nasa.test/apollo.jpg" }],
          }],
        },
      });
    }
    if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
      const title = decodeURIComponent(href.split("/").pop() || "Subject").replace(/_/g, " ");
      const fixture = [...FIXTURES.values()].find((item) => item[1].toLowerCase() === title.toLowerCase());
      return jsonResponse({
        title,
        description: `${title} description`,
        extract: `${title} extract`,
        content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` } },
        ...(fixture?.[4] ? { originalimage: { source: fixture[4], width: 900, height: 600 } } : {}),
      });
    }
    if (href.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page")) {
      const q = new URL(href).searchParams.get("q") || "Subject";
      const fixture = [...FIXTURES.values()].find((item) => item[1].toLowerCase() === q.toLowerCase());
      return jsonResponse({ pages: [{ key: q.replace(/\s+/g, "_"), title: q, thumbnail: fixture?.[4] ? { url: fixture[4] } : undefined }] });
    }
    if (href.startsWith("https://commons.wikimedia.org/w/api.php")) {
      return jsonResponse({ query: { pages: {} } });
    }
    if (href === "https://api.openai.com/v1/images/generations") {
      throw new Error("mock contract check should not generate images");
    }
    throw new Error(`Unexpected mock fetch: ${href}`);
  };
}

async function checkMock(query) {
  globalThis.__lastKnowledgeQuery = query;
  const env = {
    NOTIFICATIONS: createKv(),
    KNOWLEDGE_TEXT_BRIDGE_URL: "https://bridge.test",
    OPENAI_API_KEY: "mock-key",
  };
  const originalFetch = globalThis.fetch;
  installMockFetch();
  try {
    const response = await worker.fetch(new Request("https://worker.test/api/ask-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }), env);
    return response.json();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function checkLive(query) {
  const workerUrl = process.env.WORKER_URL || "https://home-center-api.phhowell.workers.dev";
  const token = process.env.WORKER_TOKEN;
  if (!token) {
    usage();
    process.exit(2);
  }
  const response = await fetch(`${workerUrl}/api/ask-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function validate(query, body) {
  const failures = [];
  if (!body.type) failures.push("missing type");
  if (!body.title) failures.push("missing title");
  if (body.visualPlan?.visualFamily !== "editorial-knowledge-v1") failures.push("missing visual plan");
  if (!body.visualPlan?.compositionPattern) failures.push("missing composition pattern");
  if (!body.visualPlan?.heroStrategy) failures.push("missing hero strategy");
  if (!body.heroComposition?.pattern) failures.push("missing hero composition package");
  if (!body.heroComposition?.composition?.textSafeZone && !body.heroComposition?.textSafeZone) failures.push("missing text safe zone");
  if (body.heroComposition?.mode && !["pinned", "retrieved", "generated", "composited", "fallback"].includes(body.heroComposition.mode)) {
    failures.push(`invalid hero composition mode ${body.heroComposition.mode}`);
  }
  const assetMode = body.curatedAsset?.mode || body.visual?.assetMode || body.image?.assetMode || body.image?.mode || body.visual?.mode || "";
  if (assetMode && !["pinned", "retrieved", "generated", "fallback", "none", "rendered"].includes(assetMode)) {
    failures.push(`invalid asset mode ${assetMode}`);
  }
  if (["known", "diagram", "none"].includes(body.imageSourceType)) {
    if (body.imagePending === true) failures.push("imagePending true");
    if (body.imagePrompt) failures.push("imagePrompt present");
  }
  if (body.imageQuery && body.imagePending === true) failures.push("imageQuery triggered pending generation");
  if (body.imageSourceType === "generated" && !body.imagePrompt) failures.push("generated without imagePrompt");
  if (assetMode === "generated" && process.env.ENABLE_CURATED_HERO_GENERATION !== "true" && body.imageSourceType !== "generated") {
    failures.push("generated curated asset without explicit enable flag");
  }
  if (body.imageUrl && !(body.image?.sourceUrl || body.visual?.sourceUrl || body.visual?.metadata)) {
    failures.push("image source metadata missing");
  }
  if (["pinned", "retrieved"].includes(assetMode) && body.imageUrl && !(body.image?.sourceUrl || body.visual?.sourceUrl)) {
    failures.push("curated source metadata missing");
  }
  if (!body.profile?.relatedConcepts?.length) {
    failures.push("related chips missing");
  }
  return failures;
}

const rows = [];
let failed = false;
for (const query of QUERIES) {
  try {
    const body = live ? await checkLive(query) : await checkMock(query);
    const failures = validate(query, body);
    const assetMode = body.curatedAsset?.mode || body.visual?.assetMode || body.image?.assetMode || body.image?.mode || body.visual?.mode || "";
    failed ||= failures.length > 0;
    rows.push({
      query,
      type: body.type || "",
      imageSourceType: body.imageSourceType || "",
      imagePending: body.imagePending === true,
      imagePrompt: !!body.imagePrompt,
      heroImage: !!body.imageUrl,
      source: body.image?.source || body.visual?.source || "",
      assetMode,
      result: failures.length ? `FAIL: ${failures.join("; ")}` : "PASS",
    });
  } catch (error) {
    failed = true;
    rows.push({ query, type: "", imageSourceType: "", imagePending: "", imagePrompt: "", heroImage: "", source: "", assetMode: "", result: `FAIL: ${error.message}` });
  }
}

console.table(rows);
if (failed) process.exit(1);
