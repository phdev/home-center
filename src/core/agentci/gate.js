import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRunSnapshotFromFixture, DEFAULT_RUNS_DIR, writeRunSnapshot } from "./runRecorder.js";
import { isEmptyDiff, replayRun } from "./replayRunner.js";
import { diffRuns } from "./diff.js";
import { stableJson } from "./stableJson.js";

export const DEFAULT_REPORT_PATH = "agentci/reports/latest.md";

export async function runAgentCiGate(fixturePath, options = {}) {
  const guards = installForbiddenApiGuards();
  try {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    const forbiddenSourceReferences = await findForbiddenSourceReferences();
    const snapshot = createRunSnapshotFromFixture(fixture, options);
    const runsDir = options.runsDir ?? DEFAULT_RUNS_DIR;
    const filename = options.filename ?? `${snapshot.runId}.json`;
    const runPath = path.join(runsDir, filename);
    const storedGolden = await readOptionalRun(runPath);
    const goldenDiff = storedGolden ? diffRuns(storedGolden, snapshot) : emptyDiff();
    if (!storedGolden || isEmptyDiff(goldenDiff)) {
      await writeRunSnapshot(snapshot, { runsDir, filename });
    }
    const replay = replayRun(snapshot);
    const expected = fixture.expected ?? {};
    const assertions = [
      ...evaluateExpected(snapshot, replay, expected, goldenDiff, !!storedGolden),
      ...evaluateAgentBoundaries(snapshot, replay, fixture.agentRuns ?? []),
    ];
    const unexpectedDiff = diffRuns(snapshot, replay.recomputed);
    const passed =
      replay.matches &&
      assertions.every((assertion) => assertion.passed) &&
      isEmptyDiff(goldenDiff) &&
      guards.calls.length === 0 &&
      forbiddenSourceReferences.length === 0;
    const report = renderGateReport({
      passed,
      fixturePath,
      snapshot,
      replay,
      assertions,
      forbiddenCalls: guards.calls,
      forbiddenSourceReferences,
      goldenDiff,
      unexpectedDiff,
    });
    const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, report);

    return {
      passed,
      reportPath,
      snapshot,
      replay,
      assertions,
      forbiddenCalls: guards.calls,
      forbiddenSourceReferences,
      goldenDiff,
      unexpectedDiff,
    };
  } finally {
    guards.restore();
  }
}

function evaluateExpected(snapshot, replay, expected, goldenDiff, hasStoredGolden) {
  const cards = snapshot.cards ?? [];
  const out = [];

  for (const [key, value] of Object.entries(expected.derivedState ?? {})) {
    out.push({
      name: `derivedState.${key} remains ${JSON.stringify(value)}`,
      passed: JSON.stringify(snapshot.derivedState?.[key]) === JSON.stringify(value),
    });
  }

  for (const expectedCard of expected.cards ?? []) {
    const card = cards.find((item) => item.id === expectedCard.id);
    out.push({
      name: `expected card ${expectedCard.id} exists`,
      passed: !!card,
    });
    if (card && expectedCard.priority) {
      out.push({
        name: `card ${expectedCard.id} priority remains ${expectedCard.priority}`,
        passed: card.priority === expectedCard.priority,
      });
    }
    if (card) {
      out.push({
        name: `card ${expectedCard.id} has reason.triggeredBy`,
        passed: Array.isArray(card.reason?.triggeredBy) && card.reason.triggeredBy.length > 0,
      });
      out.push({
        name: `card ${expectedCard.id} reason.triggeredBy keys exist on derivedState`,
        passed: (card.reason?.triggeredBy ?? []).every((key) =>
          Object.prototype.hasOwnProperty.call(snapshot.derivedState ?? {}, key),
        ),
      });
      out.push({
        name: `card ${expectedCard.id} has reason.suppressedBy`,
        passed: Array.isArray(card.reason?.suppressedBy),
      });
      out.push({
        name: `card ${expectedCard.id} has reason.priorityReason`,
        passed: typeof card.reason?.priorityReason === "string" && card.reason.priorityReason.length > 0,
      });
    }
  }

  out.push({ name: "replay matches original snapshot", passed: replay.matches });
  out.push({
    name: hasStoredGolden ? "run matches stored golden snapshot" : "stored golden snapshot will be created",
    passed: !hasStoredGolden || isEmptyDiff(goldenDiff),
  });
  return out;
}

async function readOptionalRun(runPath) {
  try {
    return JSON.parse(await readFile(runPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function emptyDiff() {
  return {
    stateChanges: [],
    cardChanges: { added: [], removed: [], modified: [] },
    agentChanges: { added: [], removed: [], modified: [], byCardId: [] },
  };
}

function evaluateAgentBoundaries(snapshot, replay, rawAgentRuns = []) {
  const noAgentDiff = diffRuns(stripAgentRuns(snapshot), stripAgentRuns(replay.recomputed));
  const forbiddenPaths = findForbiddenAgentOutputPaths(snapshot.agentRuns ?? []);
  const schemaViolations = validateAgentRunSchemas(rawAgentRuns);
  const duplicateAgentRunIds = findDuplicateAgentRunIds(rawAgentRuns);
  const invalidCardLinks = validateAgentRunCardLinks(snapshot);
  const decisionAffectingRuns = (snapshot.agentRuns ?? [])
    .filter((run) => run.determinism?.affects_decisions === true)
    .map((run) => run.agentRunId)
    .sort();
  const derivedStatePaths = pathsForCategory(forbiddenPaths, "derivedState");
  const cardCreationPaths = pathsForCategory(forbiddenPaths, "cardCreation");
  const priorityVisibilityPaths = pathsForCategory(forbiddenPaths, "priorityVisibility");
  return [
    {
      name: schemaViolations.length
        ? `AgentRuns include required schema fields (${schemaViolations.join(", ")})`
        : "AgentRuns include required schema fields",
      passed: schemaViolations.length === 0,
    },
    {
      name: duplicateAgentRunIds.length
        ? `AgentRun IDs are unique (${duplicateAgentRunIds.join(", ")})`
        : "AgentRun IDs are unique",
      passed: duplicateAgentRunIds.length === 0,
    },
    {
      name: invalidCardLinks.length
        ? `AgentRun cardIds match selected cards or are null (${invalidCardLinks.join(", ")})`
        : "AgentRun cardIds match selected cards or are null",
      passed: invalidCardLinks.length === 0,
    },
    {
      name: decisionAffectingRuns.length
        ? `AgentRuns do not affect deterministic decisions (${decisionAffectingRuns.join(", ")})`
        : "AgentRuns do not affect deterministic decisions",
      passed: decisionAffectingRuns.length === 0,
    },
    {
      name: "agent output is optional for deterministic replay",
      passed: isEmptyDiff(noAgentDiff),
    },
    {
      name: derivedStatePaths.length
        ? `agent output does not modify derivedState (${derivedStatePaths.join(", ")})`
        : "agent output does not modify derivedState",
      passed: derivedStatePaths.length === 0,
    },
    {
      name: cardCreationPaths.length
        ? `agent output does not introduce cards (${cardCreationPaths.join(", ")})`
        : "agent output does not introduce cards",
      passed: cardCreationPaths.length === 0,
    },
    {
      name: priorityVisibilityPaths.length
        ? `agent output does not change priority or visibility (${priorityVisibilityPaths.join(", ")})`
        : "agent output does not change priority or visibility",
      passed: priorityVisibilityPaths.length === 0,
    },
  ];
}

function stripAgentRuns(snapshot) {
  return { ...snapshot, agentRuns: [] };
}

function findForbiddenAgentOutputPaths(agentRuns) {
  const forbiddenKeys = {
    automationallowed: "policy",
    cards: "cardCreation",
    createdcard: "cardCreation",
    derivedstate: "derivedState",
    insertcard: "cardCreation",
    newcard: "cardCreation",
    newcards: "cardCreation",
    policydecision: "policy",
    priority: "priorityVisibility",
    shoulddisplay: "priorityVisibility",
    visibility: "priorityVisibility",
  };
  const paths = [];
  for (const run of agentRuns) {
    collectForbiddenKeys(
      run.output_artifacts ?? {},
      `agentRuns.${run.agentRunId}.output_artifacts`,
      forbiddenKeys,
      paths,
    );
  }
  return paths.sort((a, b) => a.path.localeCompare(b.path));
}

function collectForbiddenKeys(value, pathPrefix, forbiddenKeys, paths) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectForbiddenKeys(item, `${pathPrefix}.${index}`, forbiddenKeys, paths),
    );
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = `${pathPrefix}.${key}`;
    const category = forbiddenKeys[normalizeKey(key)];
    if (category) paths.push({ path, category });
    collectForbiddenKeys(child, path, forbiddenKeys, paths);
  }
}

function validateAgentRunSchemas(agentRuns) {
  const violations = [];
  for (const run of agentRuns) {
    const id = run.agentRunId ?? "<missing-id>";
    if (typeof run.agentRunId !== "string" || run.agentRunId.length === 0) {
      violations.push(`${id}.agentRunId`);
    }
    if (!["summary", "extraction", "suggestion"].includes(run.purpose)) {
      violations.push(`${id}.purpose`);
    }
    if (!Object.prototype.hasOwnProperty.call(run, "cardId")) {
      violations.push(`${id}.cardId`);
    } else if (!(run.cardId === null || (typeof run.cardId === "string" && run.cardId.length > 0))) {
      violations.push(`${id}.cardId`);
    }
    if (!isPlainObject(run.input_snapshot)) {
      violations.push(`${id}.input_snapshot`);
    }
    if (!isPlainObject(run.output_artifacts)) {
      violations.push(`${id}.output_artifacts`);
    }
    if (typeof run.determinism?.replayable !== "boolean") {
      violations.push(`${id}.determinism.replayable`);
    }
    if (run.determinism?.affects_decisions !== false) {
      violations.push(`${id}.determinism.affects_decisions`);
    }
  }
  return violations.sort();
}

function findDuplicateAgentRunIds(agentRuns) {
  const counts = new Map();
  for (const run of agentRuns) {
    counts.set(run.agentRunId, (counts.get(run.agentRunId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([id, count]) => id && count > 1)
    .map(([id]) => id)
    .sort();
}

function validateAgentRunCardLinks(snapshot) {
  const cardIds = new Set((snapshot.cards ?? []).map((card) => card.id));
  return (snapshot.agentRuns ?? [])
    .filter((run) => run.cardId !== null && !cardIds.has(run.cardId))
    .map((run) => `${run.agentRunId}.cardId=${run.cardId}`)
    .sort();
}

function pathsForCategory(items, category) {
  return items.filter((item) => item.category === category).map((item) => item.path);
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function installForbiddenApiGuards() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalMediaDevices = globalThis.navigator?.mediaDevices;
  const originalSpeechRecognition = globalThis.SpeechRecognition;
  const originalWebkitSpeechRecognition = globalThis.webkitSpeechRecognition;

  globalThis.fetch = (...args) => {
    calls.push({ api: "fetch", detail: String(args[0] ?? "") });
    throw new Error("AgentCI gate forbids network calls");
  };
  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  }
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () => {
        calls.push({ api: "navigator.mediaDevices.getUserMedia", detail: "microphone" });
        throw new Error("AgentCI gate forbids microphone calls");
      },
    },
  });
  globalThis.SpeechRecognition = function SpeechRecognition() {
    calls.push({ api: "SpeechRecognition", detail: "constructor" });
    throw new Error("AgentCI gate forbids speech recognition");
  };
  globalThis.webkitSpeechRecognition = function webkitSpeechRecognition() {
    calls.push({ api: "webkitSpeechRecognition", detail: "constructor" });
    throw new Error("AgentCI gate forbids speech recognition");
  };

  return {
    calls,
    restore() {
      if (originalFetch) globalThis.fetch = originalFetch;
      else delete globalThis.fetch;
      Object.defineProperty(globalThis.navigator, "mediaDevices", {
        configurable: true,
        value: originalMediaDevices,
      });
      if (originalSpeechRecognition) globalThis.SpeechRecognition = originalSpeechRecognition;
      else delete globalThis.SpeechRecognition;
      if (originalWebkitSpeechRecognition) globalThis.webkitSpeechRecognition = originalWebkitSpeechRecognition;
      else delete globalThis.webkitSpeechRecognition;
    },
  };
}

async function findForbiddenSourceReferences(root = "src/core/agentci") {
  const files = await listFiles(root);
  const matches = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const hasForbiddenImport = text
      .split("\n")
      .some((line) => /^\s*import\b/i.test(line) && /openclaw|clawAdapter/i.test(line));
    if (hasForbiddenImport) {
      matches.push({ file, reason: "AgentCI replay/gate source must not import or call OpenClaw" });
    }
  }
  return matches;
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full));
    else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) files.push(full);
  }
  return files.sort();
}

function renderGateReport({ passed, fixturePath, snapshot, replay, assertions, forbiddenCalls, forbiddenSourceReferences, goldenDiff, unexpectedDiff }) {
  const lines = [
    "# AgentCI Gate Report",
    "",
    `Status: ${passed ? "PASS" : "FAIL"}`,
    `Fixture: ${fixturePath}`,
    `Run: ${snapshot.runId}`,
    `Scenario: ${snapshot.metadata.scenarioId}`,
    "",
    "## Assertions",
    ...assertions.map((assertion) => `- ${assertion.passed ? "PASS" : "FAIL"} ${assertion.name}`),
    "",
    "## Forbidden API Calls",
    forbiddenCalls.length ? stableJson(forbiddenCalls).trim() : "None",
    "",
    "## Forbidden Source References",
    forbiddenSourceReferences.length ? stableJson(forbiddenSourceReferences).trim() : "None",
    "",
    "## Golden Diff",
    isEmptyDiff(goldenDiff) ? "No differences." : stableJson(goldenDiff).trim(),
    "",
    "## Replay Diff",
    replay.matches ? "No differences." : stableJson(replay.differences).trim(),
    "",
    "## Gate Diff",
    stableJson(unexpectedDiff).trim(),
    "",
  ];
  return `${lines.join("\n")}\n`;
}
