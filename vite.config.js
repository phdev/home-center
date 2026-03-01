import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = path.resolve(__dirname, ".pencil-queue.json");

function pencilApi() {
  return {
    name: "pencil-api",
    configureServer(server) {
      server.middlewares.use("/api/pencil-edit", (req, res) => {
        if (req.method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            try {
              const { instruction } = JSON.parse(body);
              fs.writeFileSync(
                QUEUE_FILE,
                JSON.stringify({ status: "pending", instruction, ts: Date.now() })
              );
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.writeHead(400);
              res.end("bad request");
            }
          });
        } else {
          res.writeHead(405);
          res.end();
        }
      });

      server.middlewares.use("/api/pencil-status", (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        try {
          res.end(fs.readFileSync(QUEUE_FILE, "utf-8"));
        } catch {
          res.end(JSON.stringify({ status: "idle" }));
        }
      });
    },
  };
}

export default defineConfig({
  base: "/home-center/",
  plugins: [react(), pencilApi()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
