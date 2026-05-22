import { cloneStable, stableJson } from "./stableJson.js";
import { normalizeAgentOutput } from "./normalizeAgentOutput.js";

const DEFAULT_DETERMINISM = {
  replayable: false,
  affects_decisions: false,
  notes: "Captured for audit only; AgentCI replay never calls OpenClaw.",
};

let nextSequence = 1;
const recordedAgentRuns = [];

export async function captureAgentRun(config, options = {}) {
  const sequence = reserveSequence();
  const purpose = normalizePurpose(config.purpose ?? inferAgentPurpose(config.input_snapshot?.feature));
  const inputSnapshot = safeCloneStable(config.input_snapshot ?? {});
  const cardId = normalizeCardId(config.cardId ?? inputSnapshot.cardId);
  const modelConfig = safeCloneStable(config.model_config ?? {});
  const trace = Array.isArray(config.trace) ? config.trace.map(safeCloneStable) : [];
  const start = readClock(options.clock);
  let output;
  let thrown;

  try {
    output = await config.operation();
    return output;
  } catch (error) {
    thrown = error;
    throw error;
  } finally {
    const end = readClock(options.clock);
    const outputArtifacts = thrown
      ? { error: String(thrown?.message ?? thrown), source: "error" }
      : normalizeOutputArtifacts(output);

    recordAgentRun({
      agentRunId:
        options.agentRunId ??
        deterministicAgentRunId(sequence, purpose, inputSnapshot, modelConfig),
      purpose,
      cardId,
      input_snapshot: inputSnapshot,
      model_config: modelConfig,
      trace: [
        ...trace,
        {
          step: thrown ? "openclaw.error" : "openclaw.completed",
          status: thrown ? "error" : outputArtifacts.source ?? "unknown",
        },
      ],
      output_artifacts: outputArtifacts,
      metrics: {
        latency_ms: Math.max(0, Math.round(end - start)),
        ...(Number.isFinite(options.tokens) ? { tokens: options.tokens } : {}),
      },
      determinism: config.determinism ?? DEFAULT_DETERMINISM,
    });
  }
}

export function recordAgentRun(agentRun) {
  const normalized = normalizeAgentRunShape(agentRun);
  recordedAgentRuns.push(normalized);
  return normalized;
}

export function getRecordedAgentRuns() {
  return recordedAgentRuns.map(safeCloneStable);
}

export function clearRecordedAgentRuns() {
  recordedAgentRuns.length = 0;
  nextSequence = 1;
}

export function inferAgentPurpose(feature) {
  const name = String(feature ?? "").toLowerCase();
  if (name.includes("extract")) return "extraction";
  if (name.includes("summary") || name.includes("conflict")) return "summary";
  return "suggestion";
}

function reserveSequence() {
  const sequence = nextSequence;
  nextSequence += 1;
  return sequence;
}

function deterministicAgentRunId(sequence, purpose, inputSnapshot, modelConfig) {
  return `agentrun-${String(sequence).padStart(4, "0")}-${purpose}-${hashStable({
    input_snapshot: inputSnapshot,
    model_config: modelConfig,
  })}`;
}

function normalizeAgentRunShape(agentRun) {
  const determinism = agentRun.determinism ?? DEFAULT_DETERMINISM;
  return safeCloneStable({
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

function normalizeOutputArtifacts(output) {
  return normalizeAgentOutput({
    fields: output?.fields ?? {},
    source: output?.source ?? "unknown",
    ...(output?.error ? { error: String(output.error) } : {}),
  });
}

function normalizePurpose(value) {
  return ["summary", "extraction", "suggestion"].includes(value) ? value : "suggestion";
}

function normalizeCardId(value) {
  if (value == null || value === "") return null;
  return String(value);
}

function readClock(clock) {
  if (typeof clock === "function") return Number(clock());
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}

function hashStable(value) {
  const text = stableJson(safeCloneStable(value));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function safeCloneStable(value) {
  try {
    return cloneStable(value);
  } catch {
    return {
      unserializable: true,
      type: Object.prototype.toString.call(value),
    };
  }
}
