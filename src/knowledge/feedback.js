const TEN_MINUTES_MS = 10 * 60 * 1000;

export const NEGATIVE_KNOWLEDGE_FEEDBACK_PHRASES = Object.freeze([
  "that was wrong",
  "that's wrong",
  "that is wrong",
  "bad answer",
  "wrong answer",
  "bad response",
]);

export const NEGATIVE_IMAGE_FEEDBACK_PHRASES = Object.freeze([
  "bad image",
  "wrong image",
  "bad picture",
  "wrong picture",
  "that image is wrong",
]);

let latestKnowledgeResponse = null;
let latestKnowledgeImage = null;

export function rememberKnowledgeResponse(response, now = Date.now()) {
  if (!response || response.kind !== "knowledge") return null;
  const timestamp = Number(response.timestamp || now);
  latestKnowledgeResponse = {
    query: response.query || "",
    response,
    log_row_id: response.log_row_id || null,
    timestamp,
  };
  latestKnowledgeImage = imageTargetFromResponse(response, timestamp);
  return latestKnowledgeResponse;
}

export function getLatestKnowledgeResponse(now = Date.now(), maxAgeMs = TEN_MINUTES_MS) {
  if (!latestKnowledgeResponse) return null;
  if (now - latestKnowledgeResponse.timestamp > maxAgeMs) return null;
  return latestKnowledgeResponse;
}

export function clearLatestKnowledgeResponse() {
  latestKnowledgeResponse = null;
  latestKnowledgeImage = null;
}

export function isNegativeKnowledgeFeedbackPhrase(transcript) {
  return negativeKnowledgeFeedbackIntent(transcript) === "knowledge";
}

export function isNegativeImageFeedbackPhrase(transcript) {
  return negativeKnowledgeFeedbackIntent(transcript) === "image";
}

export function negativeKnowledgeFeedbackIntent(transcript) {
  const normalized = stripWakePhrase(transcript)
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (NEGATIVE_KNOWLEDGE_FEEDBACK_PHRASES.includes(normalized)) return "knowledge";
  if (NEGATIVE_IMAGE_FEEDBACK_PHRASES.includes(normalized)) return "image";
  return null;
}

export function getLatestKnowledgeImage(now = Date.now(), maxAgeMs = TEN_MINUTES_MS) {
  if (!latestKnowledgeImage) return null;
  if (now - latestKnowledgeImage.timestamp > maxAgeMs) return null;
  return latestKnowledgeImage;
}

export async function flagLatestKnowledgeResponse(workerSettings, now = Date.now()) {
  const target = getLatestKnowledgeResponse(now);
  if (!target?.log_row_id) {
    return { ok: true, flagged: false, reason: "no_recent_knowledge_response" };
  }
  if (!workerSettings?.url) {
    return { ok: false, flagged: false, reason: "no-worker-url" };
  }
  const res = await fetch(`${workerSettings.url}/api/knowledge-feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(workerSettings.token ? { Authorization: `Bearer ${workerSettings.token}` } : {}),
    },
    body: JSON.stringify({
      target_log_row_id: target.log_row_id,
      timestamp: target.timestamp,
      query_text: target.query,
    }),
  });
  if (!res.ok) {
    return { ok: false, flagged: false, reason: `http-${res.status}` };
  }
  return res.json();
}

export async function flagLatestKnowledgeImage(workerSettings, now = Date.now()) {
  const target = getLatestKnowledgeImage(now);
  if (!target?.log_row_id || !target.image_ref) {
    return { ok: true, flagged: false, reason: "no_recent_knowledge_image" };
  }
  if (!workerSettings?.url) {
    return { ok: false, flagged: false, reason: "no-worker-url" };
  }
  const res = await fetch(`${workerSettings.url}/api/knowledge-feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(workerSettings.token ? { Authorization: `Bearer ${workerSettings.token}` } : {}),
    },
    body: JSON.stringify({
      feedback_type: "image",
      target_log_row_id: target.log_row_id,
      timestamp: target.timestamp,
      query_text: target.query,
      image_source_type: target.image_source_type,
      image_ref: target.image_ref,
    }),
  });
  if (!res.ok) {
    return { ok: false, flagged: false, reason: `http-${res.status}` };
  }
  return res.json();
}

function imageTargetFromResponse(response, timestamp) {
  if (response.imageSourceType === "none") return null;
  const imageRef =
    response.imageUrl ||
    response.image?.url ||
    response.visual?.imageUrl ||
    response.visual?.image ||
    response.image?.sourceUrl ||
    "";
  if (!imageRef) return null;
  return {
    query: response.query || "",
    log_row_id: response.log_row_id || null,
    timestamp,
    image_source_type: response.imageSourceType || "unknown",
    image_ref: imageRef,
  };
}

function stripWakePhrase(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/^(hey|hi|hay)\s+homer[\s,.:;-]*/i, "")
    .trim();
}
