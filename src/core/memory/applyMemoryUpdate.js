import fs from "node:fs";
import path from "node:path";

import { DEFAULT_HOUSEHOLD_MEMORY_ROOT, loadHouseholdMemory } from "./loadHouseholdMemory.js";
import {
  MEMORY_CATEGORIES,
  HouseholdMemoryValidationError,
  assertValidMemoryItem,
  assertValidHouseholdMemory,
  cloneJson,
} from "./schema.js";

export function applyMemoryUpdate(update, options = {}) {
  const rootDir = options.rootDir || DEFAULT_HOUSEHOLD_MEMORY_ROOT;
  const now = options.now || new Date().toISOString();
  const memory = loadHouseholdMemory({ rootDir });

  if (!update || typeof update !== "object") {
    throw new HouseholdMemoryValidationError("memory update must be an object");
  }

  switch (update.action) {
    case "remember":
      return remember(memory, update, rootDir, now);
    case "correct":
      return correct(memory, update, rootDir, now);
    case "forget":
    case "deactivate":
      return forget(memory, update, rootDir, now);
    default:
      throw new HouseholdMemoryValidationError("memory update action must be remember, correct, or forget");
  }
}

function remember(memory, update, rootDir, now) {
  const category = assertCategory(update.category);
  const item = assertValidMemoryItem({
    ...update.item,
    updated_at: update.item?.updated_at || update.item?.created_at || now,
  });
  assertNoDuplicate(memory, item.id);

  const nextMemory = cloneJson(memory);
  nextMemory.categories[category].push(item);
  const sourceEvent = {
    event: "remember",
    item_id: item.id,
    category,
    source: item.source,
    captured_at: now,
  };
  assertValidHouseholdMemory(nextMemory);
  writeCategory(rootDir, category, nextMemory.categories[category]);
  appendJsonl(path.join(rootDir, "sources.jsonl"), sourceEvent);
  return { item, category, memory: nextMemory };
}

function correct(memory, update, rootDir, now) {
  const target = findById(memory, update.itemId);
  if (!target) {
    throw new HouseholdMemoryValidationError(`memory item not found: ${update.itemId}`);
  }
  const replacement = assertValidMemoryItem({
    ...update.replacement,
    updated_at: update.replacement?.updated_at || now,
  });
  if (replacement.id === update.itemId) {
    throw new HouseholdMemoryValidationError("replacement memory item must use a new id");
  }
  assertNoDuplicate(memory, replacement.id);

  const nextMemory = cloneJson(memory);
  const oldItem = nextMemory.categories[target.category][target.index];
  oldItem.status = update.oldStatus || "corrected";
  oldItem.updated_at = now;
  oldItem.valid_until = update.valid_until || now;
  nextMemory.categories[target.category].push(replacement);
  const correctionEvent = {
    event: "correct",
    old_item_id: update.itemId,
    new_item_id: replacement.id,
    category: target.category,
    reason: update.reason || "",
    source: replacement.source,
    captured_at: now,
  };
  assertValidHouseholdMemory(nextMemory);
  writeCategory(rootDir, target.category, nextMemory.categories[target.category]);
  appendJsonl(path.join(rootDir, "corrections.jsonl"), correctionEvent);
  return { oldItem, replacement, category: target.category, memory: nextMemory };
}

function forget(memory, update, rootDir, now) {
  const target = findById(memory, update.itemId);
  if (!target) {
    throw new HouseholdMemoryValidationError(`memory item not found: ${update.itemId}`);
  }
  if (!update.source || typeof update.source !== "object") {
    throw new HouseholdMemoryValidationError("forget requires a source object");
  }

  const nextMemory = cloneJson(memory);
  const item = nextMemory.categories[target.category][target.index];
  item.status = "inactive";
  item.updated_at = now;
  item.valid_until = update.valid_until || now;
  const correctionEvent = {
    event: "forget",
    item_id: item.id,
    category: target.category,
    reason: update.reason || "",
    source: update.source,
    captured_at: now,
  };
  assertValidHouseholdMemory(nextMemory);
  writeCategory(rootDir, target.category, nextMemory.categories[target.category]);
  appendJsonl(path.join(rootDir, "corrections.jsonl"), correctionEvent);
  return { item, category: target.category, memory: nextMemory };
}

function assertCategory(category) {
  if (!MEMORY_CATEGORIES.includes(category)) {
    throw new HouseholdMemoryValidationError(`unknown memory category: ${category}`);
  }
  return category;
}

function assertNoDuplicate(memory, itemId) {
  if (findById(memory, itemId)) {
    throw new HouseholdMemoryValidationError(`duplicate memory item id: ${itemId}`);
  }
}

function findById(memory, itemId) {
  if (!itemId) return null;
  for (const category of MEMORY_CATEGORIES) {
    const index = memory.categories[category].findIndex((item) => item.id === itemId);
    if (index >= 0) return { category, index, item: memory.categories[category][index] };
  }
  return null;
}

function writeCategory(rootDir, category, items) {
  const filePath = path.join(rootDir, `${category}.json`);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(items, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

function appendJsonl(filePath, event) {
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`);
}
