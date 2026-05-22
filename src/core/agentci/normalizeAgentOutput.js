import { sortObjectKeys } from "./stableJson.js";

const VOLATILE_KEYS = new Set([
  "timestamp",
  "timestamps",
  "requestid",
  "requestids",
  "transientmetadata",
]);

export function normalizeAgentOutput(value) {
  return sortObjectKeys(normalizeValue(value));
}

function normalizeValue(value) {
  if (typeof value === "string") {
    return value.trim().replace(/\s+/g, " ");
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (isVolatileKey(key)) continue;
    out[key] = normalizeValue(child);
  }
  return out;
}

function isVolatileKey(key) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  return VOLATILE_KEYS.has(normalized);
}
