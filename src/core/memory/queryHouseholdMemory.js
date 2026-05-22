import { MEMORY_CATEGORIES, assertValidHouseholdMemory, cloneJson } from "./schema.js";

export function queryHouseholdMemory(memory, query = {}) {
  const validMemory = assertValidHouseholdMemory(memory);
  const includeInactive = Boolean(query.includeInactive);
  const normalizedText = normalize(query.text || query.freeText || "");
  const categories = query.category ? [query.category] : MEMORY_CATEGORIES;

  const items = [];
  for (const category of categories) {
    if (!MEMORY_CATEGORIES.includes(category)) continue;
    for (const item of validMemory.categories[category]) {
      if (!includeInactive && item.status !== "active") continue;
      if (query.type && item.type !== query.type) continue;
      if (query.subject && normalize(item.subject) !== normalize(query.subject)) continue;
      if (normalizedText && !itemMatchesText(item, normalizedText)) continue;
      items.push({ category, ...cloneJson(item) });
    }
  }

  return items.sort((a, b) => {
    const subject = a.subject.localeCompare(b.subject);
    if (subject !== 0) return subject;
    return a.id.localeCompare(b.id);
  });
}

export function getMemorySource(memory, itemId) {
  const [item] = queryHouseholdMemory(memory, { includeInactive: true }).filter((candidate) => candidate.id === itemId);
  return item ? cloneJson(item.source) : null;
}

export function listMemoryByCategory(memory, category, options = {}) {
  return queryHouseholdMemory(memory, { ...options, category });
}

function itemMatchesText(item, normalizedText) {
  const haystack = normalize(
    [
      item.id,
      item.type,
      item.subject,
      item.claim,
      typeof item.value === "string" ? item.value : JSON.stringify(item.value ?? ""),
      item.source?.kind,
      item.source?.ref,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(normalizedText);
}

function normalize(value) {
  return String(value).trim().toLowerCase();
}
