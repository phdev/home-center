import { normalizeAgentRuns, normalizeCards, normalizeDerivedState } from "./normalizers.js";
import { normalizeAgentOutput } from "./normalizeAgentOutput.js";

const LATENCY_NOISE_MS = 100;

export function diffRuns(before, after) {
  return {
    stateChanges: diffObjects(
      normalizeDerivedState(before?.derivedState ?? {}),
      normalizeDerivedState(after?.derivedState ?? {}),
      "derivedState",
    ),
    cardChanges: diffCards(before?.cards ?? [], after?.cards ?? []),
    agentChanges: diffAgentRuns(before?.agentRuns ?? [], after?.agentRuns ?? []),
  };
}

export function diffCards(beforeCards, afterCards) {
  const before = mapById(normalizeCards(beforeCards));
  const after = mapById(normalizeCards(afterCards));
  const added = [];
  const removed = [];
  const modified = [];

  for (const id of sortedDifference(after.keys(), before.keys())) {
    added.push(cardSummary(after.get(id)));
  }
  for (const id of sortedDifference(before.keys(), after.keys())) {
    removed.push(cardSummary(before.get(id)));
  }
  for (const id of sortedIntersection(before.keys(), after.keys())) {
    const changes = cardFieldChanges(before.get(id), after.get(id));
    if (changes.length > 0) {
      modified.push({ id, type: after.get(id).type, changes });
    }
  }

  return { added, removed, modified };
}

export function diffAgentRuns(beforeRuns, afterRuns) {
  const before = mapAgentRunsById(normalizeAgentRuns(beforeRuns));
  const after = mapAgentRunsById(normalizeAgentRuns(afterRuns));
  const added = [];
  const removed = [];
  const modified = [];

  for (const id of sortedDifference(after.keys(), before.keys())) {
    added.push(agentRunSummary(after.get(id)));
  }
  for (const id of sortedDifference(before.keys(), after.keys())) {
    removed.push(agentRunSummary(before.get(id)));
  }
  for (const id of sortedIntersection(before.keys(), after.keys())) {
    const changes = agentRunFieldChanges(before.get(id), after.get(id));
    if (changes.length > 0) {
      modified.push({
        agentRunId: id,
        cardId: after.get(id).cardId,
        purpose: after.get(id).purpose,
        changes,
      });
    }
  }

  return { added, removed, modified, byCardId: groupAgentChangesByCardId(added, removed, modified) };
}

function cardFieldChanges(before, after) {
  const fields = [
    ["priority", before.priority, after.priority],
    ["title", cardTitle(before), cardTitle(after)],
    ["reason", reasonComparable(before.reason), reasonComparable(after.reason)],
    ["visibility", before.shouldDisplay, after.shouldDisplay],
  ];
  return fields
    .filter(([, from, to]) => JSON.stringify(from) !== JSON.stringify(to))
    .map(([field, from, to]) => ({ field, from, to }));
}

function agentRunFieldChanges(before, after) {
  const changes = [
    ...compareValue("purpose", before.purpose, after.purpose),
    ...compareValue(
      "output_artifacts",
      normalizeAgentOutput(before.output_artifacts),
      normalizeAgentOutput(after.output_artifacts),
    ),
    ...compareValue("metrics.tokens", before.metrics?.tokens, after.metrics?.tokens),
  ];
  const beforeLatency = before.metrics?.latency_ms;
  const afterLatency = after.metrics?.latency_ms;
  if (
    Number.isFinite(beforeLatency) &&
    Number.isFinite(afterLatency) &&
    Math.abs(afterLatency - beforeLatency) > LATENCY_NOISE_MS
  ) {
    changes.push({ field: "metrics.latency_ms", from: beforeLatency, to: afterLatency });
  }
  return changes;
}

function compareValue(field, from, to) {
  return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ field, from, to }];
}

function agentRunSummary(agentRun) {
  return {
    agentRunId: agentRun.agentRunId,
    cardId: agentRun.cardId,
    purpose: agentRun.purpose,
    output_artifacts: normalizeAgentOutput(agentRun.output_artifacts),
  };
}

function groupAgentChangesByCardId(added, removed, modified) {
  const groups = new Map();
  for (const [kind, items] of [
    ["added", added],
    ["removed", removed],
    ["modified", modified],
  ]) {
    for (const item of items) {
      const cardId = item.cardId ?? null;
      const key = cardId ?? "__non_ui__";
      if (!groups.has(key)) groups.set(key, { cardId, added: [], removed: [], modified: [] });
      if (kind === "modified") {
        groups.get(key).modified.push(describeAgentModification(item));
      } else {
        groups.get(key)[kind].push(item.agentRunId);
      }
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, summary: summarizeAgentGroup(group) }))
    .sort((a, b) =>
      String(a.cardId ?? "__non_ui__").localeCompare(String(b.cardId ?? "__non_ui__")),
    );
}

function describeAgentModification(item) {
  return `${item.agentRunId}: ${summarizeAgentModification(item)}`;
}

function summarizeAgentGroup(group) {
  const modifiedSummaries = group.modified.map((text) => text.replace(/^.*?: /, ""));
  if (modifiedSummaries.includes("Summary text changed")) return "Summary text changed";
  if (modifiedSummaries.includes("Agent output fields changed")) return "Agent output fields changed";
  return "Agent output changed";
}

function summarizeAgentModification(item) {
  const outputChange = item.changes.find((change) => change.field === "output_artifacts");
  if (!outputChange) return "Agent output changed";

  const fromFields = outputChange.from?.fields ?? {};
  const toFields = outputChange.to?.fields ?? {};
  const fromKeys = Object.keys(fromFields).sort();
  const toKeys = Object.keys(toFields).sort();
  if (JSON.stringify(fromKeys) !== JSON.stringify(toKeys)) {
    return "Agent output fields changed";
  }
  if (
    Object.prototype.hasOwnProperty.call(fromFields, "summary") &&
    Object.prototype.hasOwnProperty.call(toFields, "summary") &&
    fromFields.summary !== toFields.summary
  ) {
    return "Summary text changed";
  }
  return "Agent output changed";
}

function diffObjects(before, after, prefix) {
  const changes = [];
  walkDiff(before, after, prefix, changes);
  return changes;
}

function cardSummary(card) {
  return {
    id: card.id,
    type: card.type,
    priority: card.priority,
    shouldDisplay: card.shouldDisplay,
    reason: reasonText(card.reason),
  };
}

function cardTitle(card) {
  if (card.data?.items?.[0]?.title) return card.data.items[0].title;
  if (card.data?.suggestions?.[0]?.title) return card.data.suggestions[0].title;
  if (card.data?.birthday?.name) return card.data.birthday.name;
  if (card.data?.conflicts?.[0]) return "Calendar conflict";
  return card.type;
}

function reasonText(reason) {
  return reason?.priorityReason ?? "";
}

function reasonComparable(reason = {}) {
  return {
    triggeredBy: reason.triggeredBy ?? [],
    suppressedBy: reason.suppressedBy ?? [],
    priorityReason: reason.priorityReason ?? "",
  };
}

function walkDiff(from, to, path, changes) {
  if (isTimestampOnly(path, from, to)) return;
  if (JSON.stringify(from) === JSON.stringify(to)) return;
  if (isPlainObject(from) && isPlainObject(to)) {
    const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
    for (const key of [...keys].sort()) {
      walkDiff(from[key], to[key], `${path}.${key}`, changes);
    }
    return;
  }
  changes.push({ path, from, to });
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mapById(cards) {
  return new Map(cards.map((card) => [card.id, card]));
}

function mapAgentRunsById(agentRuns) {
  return new Map(agentRuns.map((run) => [run.agentRunId, run]));
}

function sortedDifference(aIter, bIter) {
  const b = new Set(bIter);
  return [...aIter].filter((id) => !b.has(id)).sort();
}

function sortedIntersection(aIter, bIter) {
  const b = new Set(bIter);
  return [...aIter].filter((id) => b.has(id)).sort();
}

function isTimestampOnly(path, from, to) {
  return (
    /(^|\.)(timestamp|timeContext)(\.|$)/i.test(path) &&
    typeof from === "string" &&
    typeof to === "string"
  );
}
