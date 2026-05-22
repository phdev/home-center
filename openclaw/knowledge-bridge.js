import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarize } from "./eval/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.basename(process.cwd()) === "openclaw"
  ? path.dirname(process.cwd())
  : process.cwd();
const KNOWLEDGE_BRIDGE_LOG_PATH = path.join(REPO_ROOT, "openclaw/logs/knowledge-bridge.jsonl");

export const KNOWLEDGE_SYSTEM_PROMPT = `You are a family knowledge assistant for a TV dashboard. Given a question, classify it and respond with valid JSON only (no markdown fencing).

Response format:
{
  "type": "location" | "person" | "fauna" | "flora" | "event" | "concept",
  "title": "Short title (2-5 words)",
  "summary": "2-3 sentence overview",
  "sections": [
    { "heading": "Section Name", "content": "A paragraph of information..." },
    ...3-4 sections
  ],
  "infographic": {
    "type": "stats",
    "items": [
      { "label": "Key Stat", "value": "Value" },
      ...3-5 items
    ]
  },
  "imageSourceType": "known" | "generated" | "diagram" | "none",
  "imageQuery": "Search-style terms for a real/canonical image or educational diagram",
  "imagePrompt": "Generation-style prompt only when imageSourceType is generated"
}

Image source rules:
- known: a real photograph, archival image, canonical portrait, landmark photo, NASA/Wikipedia/Wikimedia image, or other sourceable image exists. Use imageQuery only.
- diagram: a labeled educational diagram is the right visual, such as anatomy, cycles, mechanisms, or parts. Use imageQuery only.
- generated: the user asks for an imagined scene, hypothetical visual, or symbolic picture and no canonical image exists. Use imagePrompt only.
- none: the answer does not benefit from a visual, the query is sensitive, or the question asks for a definition, meaning, value, feeling, or abstract idea with no concrete visual referent. Omit imageQuery and imagePrompt.

For refusal-shaped responses, still return the JSON schema. Use imageSourceType "none" and omit imageQuery/imagePrompt. Put the refusal and safe redirect or escalation in summary and sections.

Visual referent rule: do not create symbolic images just because a metaphor is possible. Abstract concepts such as justice, freedom, consciousness, loneliness, fairness, or meaning should be imageSourceType none unless the user explicitly asks for a symbolic picture.

Exactly one visual field rule:
- For known or diagram, include imageQuery and omit imagePrompt.
- For generated, include imagePrompt and omit imageQuery.
- For none, omit both imageQuery and imagePrompt.

Type-specific sections to include:
- location: Overview, Geography, Culture, Fun Facts
- person: Biography, Achievements, Legacy, Fun Facts
- fauna: Description, Habitat, Diet, Fun Facts
- flora: Description, Growing Conditions, Uses, Fun Facts
- event: Overview, Timeline, Impact, Fun Facts
- concept: Explanation, History, Applications, Fun Facts

Examples:
- "what happened during the Apollo 11 mission" -> imageSourceType known, imageQuery "Apollo 11 lunar module Eagle moon surface NASA archival photo".
- "how big is the Sun" -> imageSourceType known, imageQuery "NASA Sun image solar disk Earth size comparison".
- "who is Ada Lovelace" -> imageSourceType known, imageQuery "Ada Lovelace portrait Wikimedia Commons".
- "where is Mount Everest" -> imageSourceType known, imageQuery "Mount Everest Himalayas photo".
- "what does the Eiffel Tower look like" -> imageSourceType known, not generated, imageQuery "Eiffel Tower Paris photograph".
- "what is the meaning of justice" -> imageSourceType none.
- "what does freedom mean" -> imageSourceType none.
- "what is consciousness" -> imageSourceType none.
- "what is photosynthesis" -> imageSourceType diagram, imageQuery "photosynthesis process diagram".
- "how does a transformer work" -> imageSourceType diagram, imageQuery "electrical transformer labeled diagram".
- "explain the parts of a flower" -> imageSourceType diagram, imageQuery "labeled flower anatomy diagram".
- "what is an ibis" -> imageSourceType known, imageQuery "ibis bird wetland photograph".
- "what is a Joshua tree" -> imageSourceType known, imageQuery "Joshua tree photograph Mojave Desert".
- "tell me about Kyoto" -> imageSourceType known, imageQuery "Kyoto Japan temple photograph".
- "draw a picture of democracy" -> imageSourceType generated, imagePrompt "A simple symbolic civic scene showing people voting and discussing ideas peacefully, family-friendly, not photorealistic".
- "is red wine good for your heart" -> imageSourceType none.
- "what is my neighbor's home address" -> refuse in valid JSON, imageSourceType none.

Keep all content family-friendly and concise. Each section should be 2-4 sentences.`;

// TODO: Add direct openclaw /knowledge-json endpoint coverage; current tests only
// exercise the Worker /api/ask-query bridge consumer.

let routerTiersPromise = null;

export async function loadRouterTiers() {
  process.env.CACHE_DB_PATH ||= path.join(REPO_ROOT, "openclaw/cache/semantic.db");
  process.env.LOGS_DIR ||= path.join(REPO_ROOT, "openclaw/logs");
  process.env.DASHBOARD_STATE_PATH ||= path.join(REPO_ROOT, "openclaw/logs/dashboard-state.json");
  routerTiersPromise ||= Promise.all([
    import("./router/tiers/openai.js"),
    import("./router/tiers/local.js"),
    import("./router/tiers/anthropic.js"),
    import("./router/tiers/cache.js"),
  ]).then(([openai, local, anthropic, cache]) => ({ openai, local, anthropic, cache }));
  return routerTiersPromise;
}

export function stripJsonFence(raw) {
  return String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

export function parseJsonResponse(raw) {
  return JSON.parse(stripJsonFence(raw));
}

const IMAGE_SOURCE_TYPES = new Set(["known", "generated", "diagram", "none"]);

export function normalizeKnowledgeJsonShape(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const normalized = { ...parsed };
  const sourceType = IMAGE_SOURCE_TYPES.has(normalized.imageSourceType)
    ? normalized.imageSourceType
    : inferImageSourceType(normalized);
  normalized.imageSourceType = sourceType;

  const imageQuery = typeof normalized.imageQuery === "string" ? normalized.imageQuery.trim() : "";
  const imagePrompt = typeof normalized.imagePrompt === "string" ? normalized.imagePrompt.trim() : "";

  if (sourceType === "known" || sourceType === "diagram") {
    normalized.imageQuery = imageQuery || imagePrompt || normalized.title || "";
    delete normalized.imagePrompt;
  } else if (sourceType === "generated") {
    normalized.imagePrompt = imagePrompt || imageQuery || normalized.title || "";
    delete normalized.imageQuery;
  } else {
    delete normalized.imageQuery;
    delete normalized.imagePrompt;
  }

  return normalized;
}

function inferImageSourceType(parsed) {
  if (!parsed?.imagePrompt && !parsed?.imageQuery) return "none";
  const type = parsed?.type;
  if (["location", "person", "fauna", "flora", "event"].includes(type)) return "known";
  return "generated";
}

export function splitMessages(messages = []) {
  const normalized = Array.isArray(messages)
    ? messages.filter((m) => m && typeof m.content === "string")
    : [];
  const systemPrompt = normalized.find((m) => m.role === "system")?.content || "";
  const nonSystem = normalized.filter((m) => m.role !== "system");
  const lastUserIndex = nonSystem.map((m) => m.role).lastIndexOf("user");
  const userIndex = lastUserIndex >= 0 ? lastUserIndex : nonSystem.length - 1;
  const user = userIndex >= 0 ? nonSystem[userIndex]?.content || "" : "";
  const history = nonSystem.filter((_, i) => i !== userIndex);
  return { systemPrompt, user, history };
}

function queryHash(query) {
  return `sha256:${createHash("sha256").update(String(query || "")).digest("hex").slice(0, 16)}`;
}

function createLogRowId(prefix = "kb") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function appendKnowledgeBridgeLog(record) {
  const dir = path.dirname(KNOWLEDGE_BRIDGE_LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(KNOWLEDGE_BRIDGE_LOG_PATH, `${JSON.stringify(record)}\n`);
}

export function appendKnowledgeFeedbackFlag({
  targetLogRowId,
  queryText,
  flaggedAt = new Date().toISOString(),
  flagType = "user_negative",
  imageSourceType,
  imageRef,
}) {
  const target = String(targetLogRowId || "").trim();
  if (!target) {
    throw new Error("target_log_row_id is required");
  }
  const record = {
    flag_type: flagType,
    target_log_row_id: target,
    flagged_at: flaggedAt,
    query_text: String(queryText || ""),
  };
  if (flagType === "user_negative_image") {
    record.image_source_type = String(imageSourceType || "");
    record.image_ref = String(imageRef || "");
  }
  appendKnowledgeBridgeLog(record);
  return record;
}

export async function completeKnowledgeJson({ messages, temperature, maxTokens }) {
  const start = Date.now();
  const { openai, local, anthropic, cache } = await loadRouterTiers();
  const { systemPrompt, user, history } = splitMessages(messages);
  if (!user) {
    throw new Error("messages must include a user message");
  }

  const logRecord = {
    log_row_id: createLogRowId(),
    timestamp: new Date().toISOString(),
    query_hash: queryHash(user),
    tier_used: null,
    openai_attempted: false,
    openai_parse_ok: false,
    openai_request_ok: false,
    local_attempted: false,
    local_parse_ok: false,
    local_request_ok: false,
    latency_ms: 0,
    model: null,
  };

  const context = {
    systemPrompt,
    history,
    temperature: temperature ?? 0.2,
    maxTokens: maxTokens ?? 1024,
  };

  try {
    if (openai.available()) {
      logRecord.openai_attempted = true;
      try {
        const result = await openai.complete(user, context);
        logRecord.openai_request_ok = true;
        logRecord.model = result.model || null;
        const parsed = normalizeKnowledgeJsonShape(parseJsonResponse(result.response));
        logRecord.openai_parse_ok = true;
        logRecord.tier_used = "openai";
        cache.store(user, result.response).catch(() => {});
        return { json: parsed, tier: "openai", model: result.model || null, log_row_id: logRecord.log_row_id };
      } catch (err) {
        console.error("Knowledge bridge OpenAI failed; falling back to local/Sonnet:", err.message);
      }
    }

    if (local.available()) {
      logRecord.local_attempted = true;
      try {
        const result = await local.complete(user, context);
        logRecord.local_request_ok = true;
        logRecord.model = result.model || null;
        const parsed = normalizeKnowledgeJsonShape(parseJsonResponse(result.response));
        logRecord.local_parse_ok = true;
        logRecord.tier_used = "local";
        cache.store(user, result.response).catch(() => {});
        return { json: parsed, tier: "local", model: result.model || null, log_row_id: logRecord.log_row_id };
      } catch (err) {
        console.error("Knowledge bridge local/Gemma failed; escalating to Sonnet:", err.message);
      }
    }

    if (anthropic.available()) {
      const result = await anthropic.complete(user, context, "sonnet");
      logRecord.model = result.model || null;
      const parsed = normalizeKnowledgeJsonShape(parseJsonResponse(result.response));
      logRecord.tier_used = "anthropic-sonnet";
      cache.store(user, result.response).catch(() => {});
      return { json: parsed, tier: "anthropic-sonnet", model: result.model || null, log_row_id: logRecord.log_row_id };
    }

    throw new Error("No knowledge text model available on bridge");
  } finally {
    logRecord.latency_ms = Date.now() - start;
    appendKnowledgeBridgeLog(logRecord);
  }
}

export function summarizeKnowledgeBridge(date = new Date()) {
  const targetDate = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  if (!fs.existsSync(KNOWLEDGE_BRIDGE_LOG_PATH)) {
    return emptyKnowledgeBridgeSummary();
  }

  const rows = fs.readFileSync(KNOWLEDGE_BRIDGE_LOG_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((row) => row?.timestamp?.startsWith(targetDate));

  if (!rows.length) return emptyKnowledgeBridgeSummary();

  const localAttempts = rows.filter((row) => row.local_attempted);
  const localParseFailures = localAttempts.filter((row) => row.local_request_ok && !row.local_parse_ok).length;
  const localRequestFailures = localAttempts.filter((row) => !row.local_request_ok).length;
  const openaiAttempts = rows.filter((row) => row.openai_attempted);
  const openaiSuccess = rows.filter((row) => row.tier_used === "openai").length;
  const localSuccess = rows.filter((row) => row.tier_used === "local").length;
  const anthropicSuccess = rows.filter((row) => row.tier_used === "anthropic-sonnet").length;
  const latency = summarize(rows.map((row) => row.latency_ms || 0));

  return {
    total: rows.length,
    openai_success: openaiSuccess,
    local_success: localSuccess,
    local_parse_failures: localParseFailures,
    local_request_failures: localRequestFailures,
    anthropic_success: anthropicSuccess,
    openai_json_parse_rate: openaiAttempts.length ? openaiSuccess / openaiAttempts.length : 0,
    gemma_json_parse_rate: localAttempts.length ? localSuccess / localAttempts.length : 0,
    escalation_rate: rows.length ? anthropicSuccess / rows.length : 0,
    p50_latency_ms: Math.round(latency.p50),
    p90_latency_ms: Math.round(latency.p90),
  };
}

function emptyKnowledgeBridgeSummary() {
  return {
    total: 0,
    openai_success: 0,
    local_success: 0,
    local_parse_failures: 0,
    local_request_failures: 0,
    anthropic_success: 0,
    openai_json_parse_rate: 0,
    gemma_json_parse_rate: 0,
    escalation_rate: 0,
    p50_latency_ms: 0,
    p90_latency_ms: 0,
  };
}
