#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffRuns } from "../src/core/agentci/diff.js";
import { explainAgentRun, explainCard } from "../src/core/agentci/explainer.js";
import { runAgentCiGate } from "../src/core/agentci/gate.js";
import { loadRunSnapshot, replayRunFromFile } from "../src/core/agentci/replayRunner.js";
import { recordRunFromFixture } from "../src/core/agentci/runRecorder.js";
import { stableJson } from "../src/core/agentci/stableJson.js";

const DEFAULT_FIXTURE = "agentci/fixtures/school-updates-digest.json";
const DEFAULT_AGENT_FIXTURE = "agentci/fixtures/school-updates-digest-with-agent.json";
const DEFAULT_GATE_FIXTURES = [DEFAULT_FIXTURE, DEFAULT_AGENT_FIXTURE];
const DEFAULT_RUN = "agentci/runs/school-updates-digest-20260501T190000000Z.json";
const DEFAULT_CARD = "school-updates";

const [command = "help", ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

try {
  if (command === "record") {
    const fixture = args.fixture ?? DEFAULT_FIXTURE;
    const result = await recordRunFromFixture(fixture, {
      filename: args.out ? path.basename(args.out) : undefined,
      runsDir: args.out ? path.dirname(args.out) : undefined,
    });
    console.log(`Recorded AgentCI run: ${result.path}`);
  } else if (command === "replay") {
    const runPath = args.run ?? DEFAULT_RUN;
    const result = await replayRunFromFile(runPath);
    console.log(stableJson({ matches: result.matches, differences: result.differences }));
    process.exitCode = result.matches ? 0 : 1;
  } else if (command === "diff") {
    const before = await loadRunSnapshot(args.before ?? DEFAULT_RUN);
    const after = await loadRunSnapshot(args.after ?? DEFAULT_RUN);
    console.log(stableJson(diffRuns(before, after)));
  } else if (command === "explain") {
    const run = await loadRunSnapshot(args.run ?? DEFAULT_RUN);
    console.log(
      args["agent-run"]
        ? explainAgentRun(run, args["agent-run"])
        : explainCard(run, args.card ?? DEFAULT_CARD),
    );
  } else if (command === "gate") {
    const fixturePaths = args.fixture ? [args.fixture] : DEFAULT_GATE_FIXTURES;
    const results = [];
    for (const fixturePath of fixturePaths) {
      const reportPath =
        fixturePaths.length === 1
          ? args.report ?? "agentci/reports/latest.md"
          : `agentci/reports/${path.basename(fixturePath, ".json")}.md`;
      results.push(await runAgentCiGate(fixturePath, { reportPath }));
    }
    const passed = results.every((result) => result.passed);
    const reportPath = args.report ?? "agentci/reports/latest.md";
    if (fixturePaths.length > 1) {
      await writeGateSuiteReport(results, reportPath);
    }
    console.log(`AgentCI gate ${passed ? "PASS" : "FAIL"}: ${reportPath}`);
    for (const result of results) {
      console.log(`- ${result.passed ? "PASS" : "FAIL"} ${result.snapshot.metadata.scenarioId}: ${result.reportPath}`);
    }
    process.exitCode = passed ? 0 : 1;
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error?.stack ?? error?.message ?? String(error));
  process.exitCode = 1;
}

async function writeGateSuiteReport(results, reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  const passed = results.every((result) => result.passed);
  const lines = [
    "# AgentCI Gate Suite Report",
    "",
    `Status: ${passed ? "PASS" : "FAIL"}`,
    "",
    "## Fixtures",
    ...results.map(
      (result) =>
        `- ${result.passed ? "PASS" : "FAIL"} ${result.snapshot.metadata.scenarioId}: ${result.reportPath}`,
    ),
    "",
  ];
  await writeFile(reportPath, `${lines.join("\n")}\n`);
}

function parseArgs(items) {
  const out = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.startsWith("--")) continue;
    out[item.slice(2)] = items[i + 1];
    i++;
  }
  return out;
}

function printHelp() {
  console.log(`AgentCI commands:
  record  --fixture ${DEFAULT_FIXTURE} [--out ${DEFAULT_RUN}]
  replay  --run ${DEFAULT_RUN}
  diff    --before ${DEFAULT_RUN} --after ${DEFAULT_RUN}
  explain --run ${DEFAULT_RUN} --card ${DEFAULT_CARD}
  explain --run ${DEFAULT_RUN} --agent-run agentrun-0001-summary-abc123
  gate    [--fixture ${DEFAULT_FIXTURE}] [--report agentci/reports/latest.md]
`);
}
