import { readFile } from "node:fs/promises";
import { computeDerivedState } from "../derivations/index.js";
import { runInterventionEngine } from "../interventions/engine.js";
import { diffRuns } from "./diff.js";
import { normalizeRawData, normalizeRunSnapshot } from "./normalizers.js";

export async function loadRunSnapshot(runPath) {
  return normalizeRunSnapshot(JSON.parse(await readFile(runPath, "utf8")));
}

export async function replayRunFromFile(runPath, options = {}) {
  return replayRun(await loadRunSnapshot(runPath), options);
}

export function replayRun(snapshot, options = {}) {
  const original = normalizeRunSnapshot(snapshot);
  const now = new Date(options.now ?? original.metadata.timeContext.now);
  const user = options.user ?? original.metadata.timeContext.user ?? { isPeter: true };
  const rawData = normalizeRawData(original.rawData);
  const derivedState = computeDerivedState(rawData, { now, user });
  const cards = runInterventionEngine(derivedState, { now });
  const recomputed = normalizeRunSnapshot({
    ...original,
    rawData,
    derivedState,
    cards,
    metadata: {
      ...original.metadata,
      timeContext: { ...original.metadata.timeContext, now: now.toISOString(), user },
    },
  });
  const differences = diffRuns(original, recomputed);
  const matches = isEmptyDiff(differences);

  return { matches, differences, original, recomputed };
}

export function isEmptyDiff(diff) {
  return (
    diff.stateChanges.length === 0 &&
    diff.cardChanges.added.length === 0 &&
    diff.cardChanges.removed.length === 0 &&
    diff.cardChanges.modified.length === 0 &&
    (diff.agentChanges?.added ?? []).length === 0 &&
    (diff.agentChanges?.removed ?? []).length === 0 &&
    (diff.agentChanges?.modified ?? []).length === 0 &&
    (diff.agentChanges?.byCardId ?? []).length === 0
  );
}
