export const MEMORY_CATEGORIES = Object.freeze([
  "people",
  "routines",
  "preferences",
  "places",
  "school",
  "facts",
]);

export const MEMORY_CONFIDENCE = Object.freeze([
  "unverified",
  "inferred",
  "user_confirmed",
  "system_confirmed",
]);

export const MEMORY_STATUS = Object.freeze(["active", "corrected", "inactive"]);

export const ALLOWED_USES = Object.freeze([
  "conversation",
  "suggestion",
  "explanation",
  "dashboard_context",
]);

export const DISALLOWED_USES = Object.freeze([
  "card_visibility_without_derived_state",
  "reminder_timing_without_derived_state",
  "priority_without_intervention_engine",
  "derived_state_truth_without_contract",
]);

export const REQUIRED_DISALLOWED_USES = Object.freeze([
  "card_visibility_without_derived_state",
  "reminder_timing_without_derived_state",
  "priority_without_intervention_engine",
]);

const ALLOWED_USE_SET = new Set(ALLOWED_USES);
const DISALLOWED_USE_SET = new Set(DISALLOWED_USES);
const REQUIRED_DISALLOWED_USE_SET = new Set(REQUIRED_DISALLOWED_USES);
const CONFIDENCE_SET = new Set(MEMORY_CONFIDENCE);
const STATUS_SET = new Set(MEMORY_STATUS);

export class HouseholdMemoryValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "HouseholdMemoryValidationError";
    this.details = details;
  }
}

export function emptyHouseholdMemory() {
  return {
    categories: Object.fromEntries(MEMORY_CATEGORIES.map((category) => [category, []])),
    sources: [],
    corrections: [],
  };
}

export function assertJsonSafe(value, path = "memory") {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new Error("value is not JSON serializable");
    }
    JSON.parse(encoded);
  } catch (error) {
    throw new HouseholdMemoryValidationError(`${path} must be JSON-safe`, [String(error.message || error)]);
  }
}

export function cloneJson(value) {
  assertJsonSafe(value);
  return JSON.parse(JSON.stringify(value));
}

export function assertValidMemoryItem(item, path = "item") {
  const errors = validateMemoryItem(item, path);
  if (errors.length) {
    throw new HouseholdMemoryValidationError(`${path} is invalid`, errors);
  }
  return cloneJson(item);
}

export function validateMemoryItem(item, path = "item") {
  const errors = [];
  const push = (field, message) => errors.push(`${path}.${field}: ${message}`);

  if (!isPlainObject(item)) {
    return [`${path}: must be an object`];
  }

  for (const field of [
    "id",
    "type",
    "subject",
    "source",
    "confidence",
    "created_at",
    "updated_at",
    "valid_from",
    "status",
    "allowed_uses",
    "disallowed_uses",
  ]) {
    if (!(field in item)) push(field, "is required");
  }

  if (!("claim" in item) && !("value" in item)) {
    push("claim", "or value is required");
  }

  for (const field of ["id", "type", "subject"]) {
    if (typeof item[field] !== "string" || !item[field].trim()) {
      push(field, "must be a non-empty string");
    }
  }

  if ("claim" in item && typeof item.claim !== "string") {
    push("claim", "must be a string when present");
  }

  if ("value" in item) {
    try {
      assertJsonSafe(item.value, `${path}.value`);
    } catch (error) {
      push("value", error.message);
    }
  }

  validateSource(item.source, `${path}.source`, errors);

  if (!CONFIDENCE_SET.has(item.confidence)) {
    push("confidence", `must be one of ${MEMORY_CONFIDENCE.join(", ")}`);
  }

  if (!STATUS_SET.has(item.status)) {
    push("status", `must be one of ${MEMORY_STATUS.join(", ")}`);
  }

  for (const field of ["created_at", "updated_at", "valid_from"]) {
    if (!isIsoDate(item[field])) push(field, "must be an ISO timestamp");
  }

  if (item.valid_until !== null && item.valid_until !== undefined && !isIsoDate(item.valid_until)) {
    push("valid_until", "must be null, omitted, or an ISO timestamp");
  }

  validateUses(item.allowed_uses, "allowed_uses", ALLOWED_USE_SET, errors, path);
  validateUses(item.disallowed_uses, "disallowed_uses", DISALLOWED_USE_SET, errors, path);

  if (Array.isArray(item.disallowed_uses)) {
    for (const requiredUse of REQUIRED_DISALLOWED_USE_SET) {
      if (!item.disallowed_uses.includes(requiredUse)) {
        push("disallowed_uses", `must include ${requiredUse}`);
      }
    }
  }

  if (Array.isArray(item.allowed_uses)) {
    for (const use of item.allowed_uses) {
      if (DISALLOWED_USE_SET.has(use)) {
        push("allowed_uses", `${use} is a disallowed use and cannot be allowed`);
      }
    }
  }

  return errors;
}

export function assertValidHouseholdMemory(memory) {
  const errors = validateHouseholdMemory(memory);
  if (errors.length) {
    throw new HouseholdMemoryValidationError("household memory is invalid", errors);
  }
  return cloneJson(memory);
}

export function validateHouseholdMemory(memory) {
  const errors = [];
  if (!isPlainObject(memory)) {
    return ["memory: must be an object"];
  }
  if (!isPlainObject(memory.categories)) {
    errors.push("memory.categories: must be an object");
    return errors;
  }
  for (const category of MEMORY_CATEGORIES) {
    const items = memory.categories[category];
    if (!Array.isArray(items)) {
      errors.push(`memory.categories.${category}: must be an array`);
      continue;
    }
    items.forEach((item, index) => {
      errors.push(...validateMemoryItem(item, `memory.categories.${category}[${index}]`));
    });
  }
  for (const category of Object.keys(memory.categories)) {
    if (!MEMORY_CATEGORIES.includes(category)) {
      errors.push(`memory.categories.${category}: unknown category`);
    }
  }
  if (!Array.isArray(memory.sources)) {
    errors.push("memory.sources: must be an array");
  }
  if (!Array.isArray(memory.corrections)) {
    errors.push("memory.corrections: must be an array");
  }
  return errors;
}

export function createMemoryItem(overrides) {
  const now = overrides.created_at || new Date().toISOString();
  const item = {
    id: overrides.id,
    type: overrides.type,
    subject: overrides.subject,
    source: overrides.source,
    confidence: overrides.confidence || "user_confirmed",
    created_at: now,
    updated_at: overrides.updated_at || now,
    valid_from: overrides.valid_from || now,
    valid_until: overrides.valid_until ?? null,
    status: overrides.status || "active",
    allowed_uses: overrides.allowed_uses || ["conversation", "suggestion", "explanation"],
    disallowed_uses: overrides.disallowed_uses || [...REQUIRED_DISALLOWED_USES],
  };
  if ("claim" in overrides) item.claim = overrides.claim;
  if ("value" in overrides) item.value = overrides.value;
  return assertValidMemoryItem(item);
}

function validateSource(source, path, errors) {
  if (!isPlainObject(source)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  for (const field of ["kind", "ref", "captured_at"]) {
    if (!(field in source)) {
      errors.push(`${path}.${field}: is required`);
    }
  }
  if (typeof source.kind !== "string" || !source.kind.trim()) {
    errors.push(`${path}.kind: must be a non-empty string`);
  }
  if (typeof source.ref !== "string" || !source.ref.trim()) {
    errors.push(`${path}.ref: must be a non-empty string`);
  }
  if (!isIsoDate(source.captured_at)) {
    errors.push(`${path}.captured_at: must be an ISO timestamp`);
  }
}

function validateUses(uses, field, allowedSet, errors, path) {
  if (!Array.isArray(uses) || uses.length === 0) {
    errors.push(`${path}.${field}: must be a non-empty array`);
    return;
  }
  for (const use of uses) {
    if (typeof use !== "string" || !use.trim()) {
      errors.push(`${path}.${field}: entries must be non-empty strings`);
    } else if (!allowedSet.has(use)) {
      errors.push(`${path}.${field}: unknown use ${use}`);
    }
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
