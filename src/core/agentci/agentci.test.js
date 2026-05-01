import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import * as openclaw from "../../ai/openclaw";
import { augmentCardWithClaw } from "../agents/clawAdapter";
import { clearRecordedAgentRuns, getRecordedAgentRuns } from "./agentRunRecorder";
import { diffRuns } from "./diff";
import { explainAgentRun, explainCard } from "./explainer";
import { runAgentCiGate } from "./gate";
import { normalizeAgentOutput } from "./normalizeAgentOutput";
import { replayRun } from "./replayRunner";
import { createRunSnapshotFromFixture } from "./runRecorder";
import fixture from "../../../agentci/fixtures/school-updates-digest.json";

afterEach(() => {
  vi.restoreAllMocks();
  clearRecordedAgentRuns();
});

const SAMPLE_AGENT_RUN = {
  agentRunId: "agentrun-0001-summary-sample",
  purpose: "summary",
  cardId: "school-updates",
  input_snapshot: {
    cardId: "school-updates",
    cardType: "SchoolUpdatesCard",
    feature: "schoolUpdatesSummary",
    state: [{ id: "school-action-permission-slip", title: "Return field trip permission slip" }],
  },
  model_config: {
    provider: "openclaw",
    endpoint: "/api/claw/enhance",
    workerConfigured: true,
    timeoutMs: 6000,
  },
  trace: [
    {
      step: "openclaw.enhance",
      feature: "schoolUpdatesSummary",
    },
    {
      step: "openclaw.completed",
      status: "openclaw",
    },
  ],
  output_artifacts: {
    fields: {
      summary: "Permission slip needs to be returned tomorrow.",
    },
    source: "openclaw",
  },
  metrics: {
    latency_ms: 24,
  },
  determinism: {
    replayable: false,
    affects_decisions: false,
    notes: "Captured for audit only; AgentCI replay never calls OpenClaw.",
  },
};

describe("AgentCI deterministic snapshots", () => {
  it("identical input produces identical output", () => {
    const first = createRunSnapshotFromFixture(fixture);
    const second = createRunSnapshotFromFixture(fixture);

    expect(second).toEqual(first);
  });

  it("replay matches the original snapshot", () => {
    const snapshot = createRunSnapshotFromFixture(fixture);
    const replay = replayRun(snapshot);

    expect(replay.matches).toBe(true);
    expect(replay.differences).toEqual({
      stateChanges: [],
      cardChanges: { added: [], removed: [], modified: [] },
      agentChanges: { added: [], removed: [], modified: [], byCardId: [] },
    });
  });

  it("records normalized CommandEvent fixtures", () => {
    const snapshot = createRunSnapshotFromFixture(fixture);

    expect(snapshot.commandEvents).toEqual([
      {
        source: "fixture",
        transcript: "show school updates",
        wakewordDetected: true,
        confidenceBucket: "high",
        locale: "en-US",
        deviceType: "agentci-fixture",
      },
    ]);
  });
});

describe("AgentCI AgentRun recording", () => {
  it("records identical agentRuns for identical mocked OpenClaw input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ fields: { summary: "Permission slip due tomorrow." } }),
        }),
      ),
    );
    await openclaw.enhance(
      {
        feature: "schoolUpdatesSummary",
        state: { itemIds: ["school-action-permission-slip"] },
        opts: { agentciClock: fixedClock(10, 34) },
      },
      { url: "http://worker.local", token: "secret-token" },
    );
    const first = getRecordedAgentRuns();

    clearRecordedAgentRuns();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ fields: { summary: "Permission slip due tomorrow." } }),
        }),
      ),
    );
    await openclaw.enhance(
      {
        feature: "schoolUpdatesSummary",
        state: { itemIds: ["school-action-permission-slip"] },
        opts: { agentciClock: fixedClock(10, 34) },
      },
      { url: "http://worker.local", token: "secret-token" },
    );

    expect(getRecordedAgentRuns()).toEqual(first);
    expect(first[0].purpose).toBe("summary");
    expect(first[0].cardId).toBe(null);
    expect(first[0].model_config).not.toHaveProperty("token");
    expect(first[0].metrics.latency_ms).toBe(24);
  });

  it("records cardId for card-level OpenClaw enhancement calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ fields: { summary: "Card summary." } }),
        }),
      ),
    );
    const snapshot = createRunSnapshotFromFixture(fixture);

    await augmentCardWithClaw(snapshot.cards[0], { url: "http://worker.local" }, {
      agentciClock: fixedClock(10, 15),
    });

    const [agentRun] = getRecordedAgentRuns();
    expect(agentRun.cardId).toBe("school-updates");
    expect(agentRun.input_snapshot.cardId).toBe("school-updates");
    expect(snapshot.cards.some((card) => card.id === agentRun.cardId)).toBe(true);
  });

  it("replay works when a recorded agent run is present but agent execution is disabled", () => {
    const snapshot = createRunSnapshotFromFixture(fixture, {
      agentRuns: [SAMPLE_AGENT_RUN],
    });
    const replay = replayRun(snapshot);

    expect(replay.matches).toBe(true);
    expect(replay.recomputed.agentRuns).toEqual(snapshot.agentRuns);
  });

  it("diff detects changed agent output artifacts", () => {
    const before = createRunSnapshotFromFixture(fixture, {
      agentRuns: [SAMPLE_AGENT_RUN],
    });
    const after = structuredClone(before);
    after.agentRuns[0].output_artifacts.fields.summary = "Changed summary.";

    expect(diffRuns(before, after).agentChanges.modified).toEqual([
      {
        agentRunId: "agentrun-0001-summary-sample",
        cardId: "school-updates",
        purpose: "summary",
        changes: [
          {
            field: "output_artifacts",
            from: {
              fields: {
                summary: "Permission slip needs to be returned tomorrow.",
              },
              source: "openclaw",
            },
            to: {
              fields: {
                summary: "Changed summary.",
              },
              source: "openclaw",
            },
          },
        ],
      },
    ]);
  });

  it("normalizes agent output strings and volatile fields", () => {
    expect(
      normalizeAgentOutput({
        fields: {
          summary: "  Permission   slip\nneeds review. ",
          requestId: "volatile-a",
          nested: { timestamp: "2026-05-01T19:00:00.000Z", detail: "  ok   now " },
        },
      }),
    ).toEqual({
      fields: {
        nested: {
          detail: "ok now",
        },
        summary: "Permission slip needs review.",
      },
    });
  });

  it("removing the agent layer still produces valid deterministic cards", () => {
    const withAgent = createRunSnapshotFromFixture(fixture, {
      agentRuns: [SAMPLE_AGENT_RUN],
    });
    const withoutAgent = { ...withAgent, agentRuns: [] };
    const replay = replayRun(withoutAgent);

    expect(replay.matches).toBe(true);
    expect(replay.recomputed.cards.map((card) => card.id)).toEqual(["school-updates"]);
  });

  it("explainAgentRun returns a deterministic explanation", () => {
    const snapshot = createRunSnapshotFromFixture(fixture, {
      agentRuns: [SAMPLE_AGENT_RUN],
    });

    expect(explainAgentRun(snapshot, "agentrun-0001-summary-sample")).toBe(
      "AgentRun agentrun-0001-summary-sample enhanced the School Updates card (school-updates) by asking OpenClaw to summarize deterministic context for school updates summary. It produced enhancement fields summary from openclaw. The card was already selected by the deterministic system; the agent did not influence visibility and did not influence priority.",
    );
  });
});

describe("AgentCI diffing", () => {
  it("detects an added card", () => {
    const before = createRunSnapshotFromFixture(fixture);
    const after = {
      ...before,
      cards: [
        ...before.cards,
        {
          id: "extra-card",
          type: "ExtraCard",
          priority: "ambient",
          shouldDisplay: true,
          reason: { triggeredBy: ["testFlag"], suppressedBy: [], priorityReason: "Test card." },
        },
      ],
    };

    expect(diffRuns(before, after).cardChanges.added).toEqual([
      {
        id: "extra-card",
        type: "ExtraCard",
        priority: "ambient",
        shouldDisplay: true,
        reason: "Test card.",
      },
    ]);
  });

  it("detects a removed card", () => {
    const before = createRunSnapshotFromFixture(fixture);
    const after = { ...before, cards: [] };

    expect(diffRuns(before, after).cardChanges.removed.map((card) => card.id)).toEqual([
      "school-updates",
    ]);
  });

  it("detects a priority change", () => {
    const before = createRunSnapshotFromFixture(fixture);
    const after = structuredClone(before);
    after.cards[0].priority = "important";

    expect(diffRuns(before, after).cardChanges.modified).toEqual([
      {
        id: "school-updates",
        type: "SchoolUpdatesCard",
        changes: [{ field: "priority", from: "urgent", to: "important" }],
      },
    ]);
  });

  it("detects an added agent run", () => {
    const before = createRunSnapshotFromFixture(fixture);
    const after = createRunSnapshotFromFixture(fixture, {
      agentRuns: [SAMPLE_AGENT_RUN],
    });

    expect(diffRuns(before, after).agentChanges.added).toEqual([
      {
        agentRunId: "agentrun-0001-summary-sample",
        cardId: "school-updates",
        purpose: "summary",
        output_artifacts: {
          fields: {
            summary: "Permission slip needs to be returned tomorrow.",
          },
          source: "openclaw",
        },
      },
    ]);
    expect(diffRuns(before, after).agentChanges.byCardId).toEqual([
      {
        cardId: "school-updates",
        summary: "Agent output changed",
        added: ["agentrun-0001-summary-sample"],
        removed: [],
        modified: [],
      },
    ]);
  });

  it("adds human-readable summaries to agent diffs by card", () => {
    const before = createRunSnapshotFromFixture(fixture, {
      agentRuns: [SAMPLE_AGENT_RUN],
    });
    const after = structuredClone(before);
    after.agentRuns[0].output_artifacts.fields.summary = "Changed summary.";

    expect(diffRuns(before, after).agentChanges.byCardId).toEqual([
      {
        cardId: "school-updates",
        summary: "Summary text changed",
        added: [],
        removed: [],
        modified: ["agentrun-0001-summary-sample: Summary text changed"],
      },
    ]);
  });

  it("summarizes agent output field additions and removals", () => {
    const before = createRunSnapshotFromFixture(fixture, {
      agentRuns: [SAMPLE_AGENT_RUN],
    });
    const after = structuredClone(before);
    after.agentRuns[0].output_artifacts.fields.suggestion = "Bring the form tomorrow.";

    expect(diffRuns(before, after).agentChanges.byCardId[0]).toEqual({
      cardId: "school-updates",
      summary: "Agent output fields changed",
      added: [],
      removed: [],
      modified: ["agentrun-0001-summary-sample: Agent output fields changed"],
    });
  });

  it("does not diff normalized whitespace, request IDs, or timestamps", () => {
    const before = createRunSnapshotFromFixture(fixture, {
      agentRuns: [
        {
          ...SAMPLE_AGENT_RUN,
          output_artifacts: {
            fields: {
              summary: "  Permission   slip needs review. ",
              requestId: "request-a",
            },
            source: "openclaw",
            timestamp: "2026-05-01T19:00:00.000Z",
          },
        },
      ],
    });
    const after = createRunSnapshotFromFixture(fixture, {
      agentRuns: [
        {
          ...SAMPLE_AGENT_RUN,
          output_artifacts: {
            source: "openclaw",
            requestId: "request-b",
            fields: {
              timestamp: "2026-05-01T19:01:00.000Z",
              summary: "Permission slip needs review.",
            },
          },
        },
      ],
    });

    expect(diffRuns(before, after).agentChanges).toEqual({
      added: [],
      removed: [],
      modified: [],
      byCardId: [],
    });
  });

  it("detects reason object changes, including triggeredBy", () => {
    const before = createRunSnapshotFromFixture(fixture);
    const after = structuredClone(before);
    after.cards[0].reason.triggeredBy = ["rankedSchoolItems"];

    expect(diffRuns(before, after).cardChanges.modified).toEqual([
      {
        id: "school-updates",
        type: "SchoolUpdatesCard",
        changes: [
          {
            field: "reason",
            from: {
              triggeredBy: ["hasSchoolActionItems", "hasUrgentSchoolItem", "rankedSchoolItems"],
              suppressedBy: [],
              priorityReason: "Urgent school item is due soon or high urgency.",
            },
            to: {
              triggeredBy: ["rankedSchoolItems"],
              suppressedBy: [],
              priorityReason: "Urgent school item is due soon or high urgency.",
            },
          },
        ],
      },
    ]);
  });

  it("diffs derived state at readable nested paths", () => {
    const before = createRunSnapshotFromFixture(fixture);
    const after = structuredClone(before);
    after.derivedState.checklist.variant.rain = true;

    expect(diffRuns(before, after).stateChanges).toContainEqual({
      path: "derivedState.checklist.variant.rain",
      from: false,
      to: true,
    });
  });
});

describe("AgentCI decision traces", () => {
  it("every card has reason.triggeredBy, reason.suppressedBy, and reason.priorityReason", () => {
    const snapshot = createRunSnapshotFromFixture(fixture);

    for (const card of snapshot.cards) {
      expect(card.reason.triggeredBy.length).toBeGreaterThan(0);
      for (const key of card.reason.triggeredBy) {
        expect(Object.prototype.hasOwnProperty.call(snapshot.derivedState, key)).toBe(true);
      }
      expect(Array.isArray(card.reason.suppressedBy)).toBe(true);
      expect(card.reason.priorityReason.length).toBeGreaterThan(0);
    }
  });

  it("explainCard returns a specific causal explanation", () => {
    const snapshot = createRunSnapshotFromFixture(fixture);

    expect(explainCard(snapshot, "school-updates")).toBe(
      "The School Updates card appeared because at least one school update requires family action, a school-related task is due soon or marked as urgent, and there is one school update important enough to rank. It was prioritized as urgent because a school-related task is due soon or has a high urgency score.",
    );
  });

  it("explainCard avoids raw derived-state flag names for mapped triggers", () => {
    const snapshot = createRunSnapshotFromFixture(fixture);
    const explanation = explainCard(snapshot, "school-updates");

    expect(explanation).not.toContain("hasSchoolActionItems");
    expect(explanation).not.toContain("hasUrgentSchoolItem");
    expect(explanation).not.toContain("rankedSchoolItems");
    expect(explanation).toContain("requires family action");
    expect(explanation).toContain("due soon or marked as urgent");
  });
});

describe("AgentCI offline boundary", () => {
  it("replay does not call OpenClaw, network, microphone, or speech APIs", () => {
    const openclawSpy = vi.spyOn(openclaw, "enhance");
    const fetchSpy = vi.fn(() => {
      throw new Error("network should not be called");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const getUserMedia = vi.fn(() => {
      throw new Error("microphone should not be called");
    });
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const speech = vi.fn(() => {
      throw new Error("speech recognition should not be called");
    });
    vi.stubGlobal("SpeechRecognition", speech);
    vi.stubGlobal("webkitSpeechRecognition", speech);

    const replay = replayRun(createRunSnapshotFromFixture(fixture));

    expect(replay.matches).toBe(true);
    expect(openclawSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(speech).not.toHaveBeenCalled();
  });

  it("gate does not call OpenClaw, network, microphone, or speech APIs", async () => {
    const openclawSpy = vi.spyOn(openclaw, "enhance");
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const result = await runAgentCiGate("agentci/fixtures/school-updates-digest.json", {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(true);
    expect(result.forbiddenCalls).toEqual([]);
    expect(openclawSpy).not.toHaveBeenCalled();
  });

  it("gate passes the agent-present golden fixture without calling OpenClaw", async () => {
    const openclawSpy = vi.spyOn(openclaw, "enhance");
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const result = await runAgentCiGate("agentci/fixtures/school-updates-digest-with-agent.json", {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(true);
    expect(result.snapshot.agentRuns.map((run) => run.agentRunId)).toEqual(["agentrun-mock-1"]);
    expect(openclawSpy).not.toHaveBeenCalled();
  });

  it("gate fails on stored golden regressions without overwriting the golden", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const runsDir = path.join(dir, "runs");
    await mkdir(runsDir, { recursive: true });
    const golden = createRunSnapshotFromFixture(fixture);
    const regressed = structuredClone(golden);
    regressed.cards[0].priority = "important";
    const runPath = path.join(runsDir, `${golden.runId}.json`);
    await writeFile(runPath, JSON.stringify(regressed, null, 2));

    const result = await runAgentCiGate("agentci/fixtures/school-updates-digest.json", {
      runsDir,
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(false);
    expect(result.goldenDiff.cardChanges.modified[0].changes).toEqual([
      { field: "priority", from: "important", to: "urgent" },
    ]);
    const stored = JSON.parse(await readFile(runPath, "utf8"));
    expect(stored.cards[0].priority).toBe("important");
  });

  it("gate fails if agent output tries to change card priority", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const fixturePath = path.join(dir, "fixture.json");
    const fixtureWithBadAgent = structuredClone(fixture);
    fixtureWithBadAgent.agentRuns = [
      {
        ...SAMPLE_AGENT_RUN,
        output_artifacts: {
          fields: {
            priority: "urgent",
          },
          source: "openclaw",
        },
      },
    ];
    await writeFile(fixturePath, JSON.stringify(fixtureWithBadAgent, null, 2));

    const result = await runAgentCiGate(fixturePath, {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(false);
    expect(result.assertions).toContainEqual({
      name: expect.stringContaining("agent output does not change priority or visibility"),
      passed: false,
    });
  });

  it("gate fails if agent output tries to modify derivedState", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const fixturePath = path.join(dir, "fixture.json");
    const fixtureWithBadAgent = structuredClone(fixture);
    fixtureWithBadAgent.agentRuns = [
      {
        ...SAMPLE_AGENT_RUN,
        output_artifacts: {
          fields: {
            derivedState: { hasUrgentSchoolItem: false },
          },
          source: "openclaw",
        },
      },
    ];
    await writeFile(fixturePath, JSON.stringify(fixtureWithBadAgent, null, 2));

    const result = await runAgentCiGate(fixturePath, {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(false);
    expect(result.assertions).toContainEqual({
      name: expect.stringContaining("agent output does not modify derivedState"),
      passed: false,
    });
  });

  it("gate fails if agent determinism says it affects decisions", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const fixturePath = path.join(dir, "fixture.json");
    const fixtureWithBadAgent = structuredClone(fixture);
    fixtureWithBadAgent.agentRuns = [
      {
        ...SAMPLE_AGENT_RUN,
        determinism: {
          replayable: false,
          affects_decisions: true,
        },
      },
    ];
    await writeFile(fixturePath, JSON.stringify(fixtureWithBadAgent, null, 2));

    const result = await runAgentCiGate(fixturePath, {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(false);
    expect(result.assertions).toContainEqual({
      name: expect.stringContaining("AgentRuns do not affect deterministic decisions"),
      passed: false,
    });
  });

  it("gate fails on duplicate AgentRun IDs", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const fixturePath = path.join(dir, "fixture.json");
    const fixtureWithBadAgent = structuredClone(fixture);
    fixtureWithBadAgent.agentRuns = [SAMPLE_AGENT_RUN, SAMPLE_AGENT_RUN];
    await writeFile(fixturePath, JSON.stringify(fixtureWithBadAgent, null, 2));

    const result = await runAgentCiGate(fixturePath, {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(false);
    expect(result.assertions).toContainEqual({
      name: expect.stringContaining("AgentRun IDs are unique"),
      passed: false,
    });
  });

  it("gate fails on invalid AgentRun purpose", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const fixturePath = path.join(dir, "fixture.json");
    const fixtureWithBadAgent = structuredClone(fixture);
    fixtureWithBadAgent.agentRuns = [
      {
        ...SAMPLE_AGENT_RUN,
        purpose: "visibility",
      },
    ];
    await writeFile(fixturePath, JSON.stringify(fixtureWithBadAgent, null, 2));

    const result = await runAgentCiGate(fixturePath, {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(false);
    expect(result.assertions).toContainEqual({
      name: expect.stringContaining("AgentRuns include required schema fields"),
      passed: false,
    });
  });

  it("gate fails when an AgentRun cardId does not match a selected card", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentci-"));
    const fixturePath = path.join(dir, "fixture.json");
    const fixtureWithBadAgent = structuredClone(fixture);
    fixtureWithBadAgent.agentRuns = [
      {
        ...SAMPLE_AGENT_RUN,
        cardId: "missing-card",
      },
    ];
    await writeFile(fixturePath, JSON.stringify(fixtureWithBadAgent, null, 2));

    const result = await runAgentCiGate(fixturePath, {
      runsDir: path.join(dir, "runs"),
      reportPath: path.join(dir, "latest.md"),
    });

    expect(result.passed).toBe(false);
    expect(result.assertions).toContainEqual({
      name: expect.stringContaining("AgentRun cardIds match selected cards or are null"),
      passed: false,
    });
  });
});

function fixedClock(start, end) {
  const values = [start, end];
  return () => values.shift() ?? end;
}
