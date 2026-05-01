import { normalizeCommandEvents } from "../commands/commandEvent.js";
import { normalizeAgentOutput } from "./normalizeAgentOutput.js";
import { cloneStable } from "./stableJson.js";

export const AGENTCI_VERSION = "agentci.v1";

export function normalizeRunSnapshot(snapshot) {
  return cloneStable({
    runId: snapshot.runId,
    timestamp: normalizeIso(snapshot.timestamp),
    rawData: normalizeRawData(snapshot.rawData),
    commandEvents: normalizeCommandEvents(snapshot.commandEvents ?? []),
    derivedState: normalizeDerivedState(snapshot.derivedState),
    cards: normalizeCards(snapshot.cards ?? []),
    agentRuns: normalizeAgentRuns(snapshot.agentRuns ?? []),
    metadata: {
      version: snapshot.metadata?.version ?? AGENTCI_VERSION,
      scenarioId: snapshot.metadata?.scenarioId ?? "unknown",
      timeContext: normalizeTimeContext(snapshot.metadata?.timeContext),
    },
  });
}

export function normalizeRawData(rawData = {}) {
  const raw = cloneStable(rawData);
  return {
    ...raw,
    calendar: {
      ...(raw.calendar ?? {}),
      events: sortBy(raw.calendar?.events ?? [], calendarEventKey),
    },
    birthdays: sortBy(raw.birthdays ?? [], (item) => item.id ?? item.name ?? ""),
    bedtime: sortBy(raw.bedtime ?? [], (item) => item.childId ?? item.childName ?? ""),
    schoolItems: sortBy(raw.schoolItems ?? [], (item) => item.id ?? item.title ?? ""),
    schoolUpdates: sortBy(raw.schoolUpdates ?? [], (item) => item.id ?? item.title ?? ""),
    schoolLunchMenu: sortBy(raw.schoolLunchMenu ?? [], (item) => item.date ?? ""),
  };
}

export function normalizeDerivedState(derivedState = {}) {
  return cloneStable({
    ...derivedState,
    conflicts: derivedState.conflicts ?? [],
    peter0800_0900Events: derivedState.peter0800_0900Events ?? [],
    rankedSchoolItems: derivedState.rankedSchoolItems ?? [],
    upcomingSchoolEvents: derivedState.upcomingSchoolEvents ?? [],
    birthdaysRanked: derivedState.birthdaysRanked ?? [],
    clawSuggestions: derivedState.clawSuggestions ?? [],
  });
}

export function normalizeCards(cards = []) {
  return cards.map((card) =>
    cloneStable({
      id: card.id,
      type: card.type,
      priority: card.priority,
      placement: card.placement,
      timeContext: card.timeContext,
      shouldDisplay: card.shouldDisplay,
      reason: normalizeReason(card.reason),
      data: card.data,
      agent: card.agent,
    }),
  );
}

export function normalizeReason(reason) {
  if (typeof reason === "string") {
    return {
      triggeredBy: [],
      suppressedBy: [],
      priorityReason: reason,
    };
  }
  return {
    triggeredBy: Array.isArray(reason?.triggeredBy) ? [...reason.triggeredBy].sort() : [],
    suppressedBy: Array.isArray(reason?.suppressedBy) ? [...reason.suppressedBy].sort() : [],
    priorityReason: String(reason?.priorityReason ?? ""),
  };
}

export function normalizeAgentRuns(agentRuns = []) {
  return sortBy(agentRuns ?? [], (run) => run.agentRunId ?? "").map(normalizeAgentRun);
}

export function normalizeAgentRun(agentRun = {}) {
  const determinism = agentRun.determinism ?? {};
  return cloneStable({
    agentRunId: String(agentRun.agentRunId ?? ""),
    purpose: normalizePurpose(agentRun.purpose),
    cardId: normalizeCardId(agentRun.cardId ?? agentRun.input_snapshot?.cardId),
    input_snapshot: agentRun.input_snapshot ?? {},
    model_config: agentRun.model_config ?? {},
    trace: Array.isArray(agentRun.trace) ? agentRun.trace : [],
    output_artifacts: normalizeAgentOutput(agentRun.output_artifacts ?? {}),
    metrics: {
      latency_ms: Number.isFinite(agentRun.metrics?.latency_ms)
        ? Math.max(0, Math.round(agentRun.metrics.latency_ms))
        : 0,
      ...(Number.isFinite(agentRun.metrics?.tokens)
        ? { tokens: Math.max(0, Math.round(agentRun.metrics.tokens)) }
        : {}),
    },
    determinism: {
      replayable: !!determinism.replayable,
      affects_decisions: determinism.affects_decisions === true,
      ...(determinism.notes ? { notes: String(determinism.notes) } : {}),
    },
  });
}

function normalizeTimeContext(timeContext = {}) {
  return {
    ...cloneStable(timeContext),
    now: normalizeIso(timeContext.now),
  };
}

function normalizeIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function normalizePurpose(value) {
  return ["summary", "extraction", "suggestion"].includes(value) ? value : "suggestion";
}

function normalizeCardId(value) {
  if (value == null || value === "") return null;
  return String(value);
}

function sortBy(items, keyFn) {
  return [...items].map(cloneStable).sort((a, b) => keyFn(a).localeCompare(keyFn(b)));
}

function calendarEventKey(event) {
  return `${event.start ?? ""}:${event.end ?? ""}:${event.id ?? event.title ?? ""}`;
}
