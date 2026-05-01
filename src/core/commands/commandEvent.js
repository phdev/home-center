const SOURCES = new Set(["voice", "text", "fixture"]);
const CONFIDENCE_BUCKETS = new Set(["high", "medium", "low", "unknown"]);

export function normalizeCommandEvent(input = {}) {
  return {
    source: SOURCES.has(input.source) ? input.source : "fixture",
    transcript: String(input.transcript ?? ""),
    wakewordDetected: input.wakewordDetected === true,
    confidenceBucket: CONFIDENCE_BUCKETS.has(input.confidenceBucket)
      ? input.confidenceBucket
      : "unknown",
    locale: String(input.locale ?? "en-US"),
    deviceType: String(input.deviceType ?? "fixture"),
  };
}

export function normalizeCommandEvents(events = []) {
  return (Array.isArray(events) ? events : []).map(normalizeCommandEvent);
}
