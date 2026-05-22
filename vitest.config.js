import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{js,jsx}", "worker/src/**/*.test.js", "openclaw/eval/**/*.test.js"],
    setupFiles: ["./src/__tests__/setup.js"],
  },
});
