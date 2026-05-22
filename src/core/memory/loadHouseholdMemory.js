import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MEMORY_CATEGORIES,
  HouseholdMemoryValidationError,
  assertValidHouseholdMemory,
  emptyHouseholdMemory,
} from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(__dirname, "../../../memory/household");

export function loadHouseholdMemory(options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const memory = emptyHouseholdMemory();

  for (const category of MEMORY_CATEGORIES) {
    memory.categories[category] = readJsonArray(path.join(rootDir, `${category}.json`), category);
  }
  memory.sources = readJsonl(path.join(rootDir, "sources.jsonl"));
  memory.corrections = readJsonl(path.join(rootDir, "corrections.jsonl"));

  return assertValidHouseholdMemory(memory);
}

export function readJsonArray(filePath, label = filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new HouseholdMemoryValidationError(`${label} could not be read as JSON`, [String(error.message || error)]);
  }
  if (!Array.isArray(parsed)) {
    throw new HouseholdMemoryValidationError(`${label} must contain a JSON array`);
  }
  return parsed;
}

export function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  if (!text.trim()) return [];
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new HouseholdMemoryValidationError(`${filePath}:${index + 1} is invalid JSONL`, [
          String(error.message || error),
        ]);
      }
    });
}

export { DEFAULT_ROOT as DEFAULT_HOUSEHOLD_MEMORY_ROOT };
