import { spawn } from "child_process";
import fs from "fs";
import readline from "readline";

const MCP_BIN = "/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64";
const PEN_FILE = "/Users/peterhowell/Documents/home-center.pen";
const OUT_DIR = "/Users/peterhowell/home-center/public/pencil-screenshots";
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
  { slug: "openclaw-ui-additions", nodeId: "ONYZi" },
];

let msgId = 0;
const pending = new Map(); // msgId -> page
let saved = 0;

const proc = spawn(MCP_BIN, ["--app", "desktop"], { stdio: ["pipe", "pipe", "pipe"] });

function send(method, params) {
  const id = ++msgId;
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return id;
}

const rl = readline.createInterface({ input: proc.stdout });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.result?.capabilities) {
      // Send all screenshot requests at once
      for (const p of pages) {
        const id = send("tools/call", { name: "get_screenshot", arguments: { filePath: PEN_FILE, nodeId: p.nodeId } });
        pending.set(id, p);
        console.log(`Requested: ${p.slug} (id=${id})`);
      }
    } else if (msg.id && pending.has(msg.id)) {
      const page = pending.get(msg.id);
      for (const c of (msg.result?.content || [])) {
        if (c.type === "image" && c.data) {
          const outPath = `${OUT_DIR}/${page.slug}.png`;
          fs.writeFileSync(outPath, Buffer.from(c.data, "base64"));
          console.log(`Saved: ${outPath} (${Math.round(c.data.length / 1024)}KB base64)`);
          saved++;
        }
      }
      if (saved >= pages.length) {
        console.log("All screenshots saved!");
        proc.kill(); process.exit(0);
      }
    }
  } catch {}
});

proc.stderr.on("data", () => {});
send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "ss", version: "1" } });
setTimeout(() => { proc.kill(); process.exit(1); }, 30000);
