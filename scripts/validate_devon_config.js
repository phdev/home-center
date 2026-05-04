#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const errors = [];

function fail(message) {
  errors.push(message);
}

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  const text = readText(relativePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function expect(condition, message) {
  if (!condition) fail(message);
}

const agentsConfig = readJson("openclaw/agents.json");
const devon = agentsConfig?.agents?.find((agent) => agent.id === "devon");

expect(Boolean(devon), "Devon agent config is missing");
if (devon) {
  expect(devon.name === "Devon", "Devon agent name must be Devon");
  expect(
    devon.role === "Home Center development and project-management claw",
    "Devon role is incorrect",
  );
  expect(
    /^openai-codex\/gpt-/.test(devon.model),
    "Devon model must use an openai-codex/gpt-* model for the working Codex harness route",
  );
  expect(devon.fallback === "none", "Devon fallback must be none");
  expect(devon.agentRuntime?.id === "codex", "Devon must use the Codex runtime");
  expect(devon.familyFacing === false, "Devon must not be family-facing");
  expect(devon.isDefault === false, "Devon must not be a default agent");
  expect(
    devon.isDefaultFamilyFacingAgent === false,
    "Devon must not be the default family-facing agent",
  );
  expect(devon.instructions === "docs/devon.md", "Devon instructions path is wrong");
}

const task = readJson("openclaw/tasks/devon-morning-brief.json");
if (task) {
  expect(task.agentId === "devon", "Morning task must target Devon");
  expect(task.agentRuntime?.id === "codex", "Morning task must use Codex runtime");
  expect(task.allowCodeChanges === false, "Morning task must not allow code changes");
  expect(task.writesCode === false, "Morning task must not write code");
  expect(task.schedule?.cron === "15 8 * * *", "Morning schedule must be 8:15 daily");
  expect(
    task.schedule?.timezone === "America/Los_Angeles",
    "Morning schedule timezone must be America/Los_Angeles",
  );
  expect(
    /David/i.test(task.prompt || "") && /design/i.test(task.prompt || ""),
    "Morning task prompt must include David design review",
  );
  expect(
    /Do not make code changes/i.test(task.prompt || ""),
    "Morning task prompt must forbid code changes",
  );
}

const instructions = readText("docs/devon.md").toLowerCase();
expect(
  instructions.includes("merge to main without explicit approval"),
  "Devon instructions must include the no-merge-without-approval rule",
);
expect(
  instructions.includes("family-facing behavior") &&
    instructions.includes("safety-sensitive config"),
  "Devon instructions must include the family-facing behavior safety rule",
);
expect(
  instructions.includes("david") && instructions.includes("build now"),
  "Devon instructions must include David design review classification",
);
expect(
  instructions.includes("chat memory") && instructions.includes("source of truth"),
  "Devon instructions must reject chat memory as durable source of truth",
);

const template = readText("docs/templates/devon-morning-brief.md");
for (const heading of [
  "## Current project state",
  "## Codex harness status",
  "## David design ideas reviewed",
  "## Recommended next steps",
  "## Best next action",
  "## Needs Peter's decision",
]) {
  expect(template.includes(heading), `Morning brief template missing ${heading}`);
}

const plist = readText("deploy/mac-mini/com.homecenter.devon-morning.plist");
expect(
  plist.includes("com.homecenter.devon-morning"),
  "Devon launchd template label is missing",
);
expect(
  /<key>Hour<\/key>\s*<integer>8<\/integer>/.test(plist) &&
    /<key>Minute<\/key>\s*<integer>15<\/integer>/.test(plist),
  "Devon launchd template must run at 8:15",
);
expect(
  plist.includes("America/Los_Angeles"),
  "Devon launchd template must include America/Los_Angeles",
);

if (errors.length) {
  console.error("Devon config validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Devon config validation passed.");
