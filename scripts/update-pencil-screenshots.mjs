import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

// Location of the Pencil MCP binary (macOS install location).
// Override with PENCIL_MCP_BIN if installed elsewhere.
const MCP_BIN =
  process.env.PENCIL_MCP_BIN ||
  "/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64";

// Path to the .pen file. Override with HOME_CENTER_PEN_FILE if you
// keep your designs somewhere other than ~/Documents.
const PEN_FILE =
  process.env.HOME_CENTER_PEN_FILE ||
  path.join(os.homedir(), "Documents", "home-center.pen");

// Screenshots land alongside the repo's public/ folder — resolved
// relative to this script so it works on any checkout.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "public", "pencil-screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const pages = [
  { slug: "family-tv-dashboard", nodeId: "8pkH2" },
  { slug: "full-calendar-page", nodeId: "85GSD" },
  { slug: "weekly-calendar-design", nodeId: "ZPJSg" },
  { slug: "daily-calendar-design", nodeId: "jRHG1" },
  { slug: "full-weather-page", nodeId: "VD32B" },
  { slug: "full-photos-page", nodeId: "ZOFqi" },
  { slug: "full-llm-response-page", nodeId: "dMUil" },
  { slug: "full-history-page", nodeId: "Tbtje" },
  { slug: "transcription-overlay", nodeId: "DeP7G" },
  { slug: "voice-transcription-overlay", nodeId: "Jf7Tx" },
  { slug: "openclaw-ui-additions", nodeId: "ONYZi" },
];

let msgId = 0;
const pending = new Map(); // msgId -> page
let saved = 0;
let failed = 0;

const proc = spawn(MCP_BIN, ["--app", "desktop"], { stdio: ["pipe", "pipe", "pipe"] });
let pageIndex = 0;

function send(method, params) {
  const id = ++msgId;
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return id;
}

function requestNext() {
  if (pageIndex >= pages.length) {
    if (failed > 0) {
      console.error(`Saved ${saved}/${pages.length} screenshots; ${failed} failed.`);
      proc.kill(); process.exit(1);
    }
    console.log("All screenshots saved!");
    proc.kill(); process.exit(0);
  }
  const p = pages[pageIndex++];
  const id = send("tools/call", { name: "get_screenshot", arguments: { filePath: PEN_FILE, nodeId: p.nodeId } });
  pending.set(id, p);
  console.log(`Requested: ${p.slug} (id=${id})`);
}

const rl = readline.createInterface({ input: proc.stdout });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.result?.capabilities) {
      requestNext();
    } else if (msg.id && pending.has(msg.id)) {
      const page = pending.get(msg.id);
      pending.delete(msg.id);
      let wrote = false;
      if (msg.error) {
        console.error(`Failed: ${page.slug} - ${msg.error.message || JSON.stringify(msg.error)}`);
      }
      for (const c of (msg.result?.content || [])) {
        if (c.type === "image" && c.data) {
          const outPath = `${OUT_DIR}/${page.slug}.png`;
          fs.writeFileSync(outPath, Buffer.from(c.data, "base64"));
          console.log(`Saved: ${outPath} (${Math.round(c.data.length / 1024)}KB base64)`);
          saved++;
          wrote = true;
        }
      }
      if (!wrote) {
        failed++;
        if (!msg.error) console.error(`Failed: ${page.slug} - no image returned`);
      }
      requestNext();
    }
  } catch {}
});

proc.stderr.on("data", () => {});
send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "ss", version: "1" } });
setTimeout(() => {
  console.error(`Timed out after saving ${saved}/${pages.length} screenshots.`);
  proc.kill(); process.exit(1);
}, 60000);
