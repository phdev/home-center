#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "home-center-sample-agent", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["openclaw/mcp/server.js"],
  env: process.env,
});

await client.connect(transport);

const calendar = await callJsonTool("calendar_read", {});
const events = (calendar.events || [])
  .filter((event) => !event.allDay)
  .map((event) => ({ ...event, startDate: new Date(event.start) }))
  .filter((event) => Number.isFinite(event.startDate.getTime()))
  .filter((event) => sameLocalDay(event.startDate, new Date()))
  .sort((a, b) => a.startDate - b.startDate);

const earlyEvent = events.find((event) => event.startDate.getHours() < 9);
if (!earlyEvent) {
  console.log("No early event found. No action needed.");
  await client.close();
  process.exit(0);
}

const now = Date.now();
const reminderAt = new Date(earlyEvent.startDate.getTime() - 60 * 60 * 1000);
const totalSeconds = Math.max(60, Math.floor((reminderAt.getTime() - now) / 1000));

const timer = await callJsonTool("set_timer", {
  name: `Wake reminder for ${earlyEvent.title}`,
  totalSeconds,
});
const tv = await callJsonTool("tv_power", { state: "on", confirm: true });

console.log(JSON.stringify({
  earlyEvent: {
    title: earlyEvent.title,
    start: earlyEvent.start,
  },
  timer,
  tv,
}, null, 2));

await client.close();

async function callJsonTool(name, args) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.find((item) => item.type === "text")?.text;
  return text ? JSON.parse(text) : result;
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
