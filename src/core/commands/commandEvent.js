const ALLOWED_SOURCES = new Set(["voice", "text", "fixture"]);
const ALLOWED_CONFIDENCE_BUCKETS = new Set(["high", "medium", "low", "unknown"]);
const ALLOWED_KEYS = new Set([
  "source",
  "transcript",
  "wakewordDetected",
  "confidenceBucket",
  "locale",
  "deviceType",
]);

function normalizeTranscript(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeString(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).normalize("NFKC").trim();
  return normalized || fallback;
}

function bucketConfidence(confidence) {
  if (confidence == null) return "unknown";
  const value = Number(confidence);
  if (!Number.isFinite(value)) return "unknown";
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

function normalizeConfidenceBucket(input) {
  if (ALLOWED_CONFIDENCE_BUCKETS.has(input.confidenceBucket)) {
    return input.confidenceBucket;
  }
  return bucketConfidence(input.confidence);
}

export function normalizeCommandEvent(event = {}) {
  const input = event && typeof event === "object" ? event : {};
  const rawSource = input.source == null ? "text" : String(input.source);

  return {
    source: rawSource,
    transcript: normalizeTranscript(input.transcript ?? input.text),
    wakewordDetected: input.wakewordDetected === true,
    confidenceBucket: normalizeConfidenceBucket(input),
    locale: normalizeString(input.locale ?? input.lang, "und"),
    deviceType: normalizeString(input.deviceType, "unknown"),
  };
}

export function normalizeCommandEvents(events = []) {
  return (Array.isArray(events) ? events : []).map(normalizeCommandEvent);
}

export function validateCommandEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false;

  const keys = Object.keys(event);
  if (keys.length !== ALLOWED_KEYS.size) return false;
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) return false;

  return (
    ALLOWED_SOURCES.has(event.source) &&
    typeof event.transcript === "string" &&
    typeof event.wakewordDetected === "boolean" &&
    ALLOWED_CONFIDENCE_BUCKETS.has(event.confidenceBucket) &&
    typeof event.locale === "string" &&
    event.locale.length > 0 &&
    typeof event.deviceType === "string" &&
    event.deviceType.length > 0
  );
}
