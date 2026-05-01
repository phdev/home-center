import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeDerivedState } from "../derivations/index.js";
import { runInterventionEngine } from "../interventions/engine.js";
import { normalizeCommandEvents } from "../commands/commandEvent.js";
import { AGENTCI_VERSION, normalizeRawData, normalizeRunSnapshot } from "./normalizers.js";
import { stableJson } from "./stableJson.js";

export const DEFAULT_RUNS_DIR = "agentci/runs";

export async function loadFixture(fixturePath) {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

export function createRunSnapshotFromFixture(fixture, options = {}) {
  const scenarioId = options.scenarioId ?? fixture.scenarioId ?? "fixture";
  const now = new Date(options.now ?? fixture.timeContext?.now ?? fixture.metadata?.timeContext?.now);
  if (!Number.isFinite(now.getTime())) {
    throw new Error(`AgentCI fixture ${scenarioId} is missing a valid timeContext.now`);
  }

  const user = options.user ?? fixture.timeContext?.user ?? { isPeter: true };
  const timeContext = { now: now.toISOString(), user };
  const rawData = normalizeRawData(fixture.rawData ?? {});
  const commandEvents = normalizeCommandEvents(fixture.commandEvents ?? []);
  const derivedState = computeDerivedState(rawData, { now, user });
  const cards = runInterventionEngine(derivedState, { now });
  const agentRuns = options.agentRuns ?? fixture.agentRuns ?? [];

  return normalizeRunSnapshot({
    runId: options.runId ?? deterministicRunId(scenarioId, now),
    timestamp: options.timestamp ?? now.toISOString(),
    rawData,
    commandEvents,
    derivedState,
    cards,
    agentRuns,
    metadata: {
      version: options.version ?? fixture.metadata?.version ?? AGENTCI_VERSION,
      scenarioId,
      timeContext,
    },
  });
}

export async function recordRunFromFixture(fixturePath, options = {}) {
  const fixture = await loadFixture(fixturePath);
  const snapshot = createRunSnapshotFromFixture(fixture, options);
  return writeRunSnapshot(snapshot, options);
}

export async function writeRunSnapshot(snapshot, options = {}) {
  const runsDir = options.runsDir ?? DEFAULT_RUNS_DIR;
  await mkdir(runsDir, { recursive: true });
  const filename = options.filename ?? `${snapshot.runId}.json`;
  const outPath = path.join(runsDir, filename);
  await writeFile(outPath, stableJson(normalizeRunSnapshot(snapshot)));
  return { path: outPath, snapshot };
}

export function deterministicRunId(scenarioId, now) {
  return `${scenarioId}-${now.toISOString().replace(/[^0-9TZ]/g, "")}`;
}
