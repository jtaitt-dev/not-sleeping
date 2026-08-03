import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/performance/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      // The whole logic layer, not a hand-picked subset: the previous list
      // measured 742 statements and left the decision pipeline, both AI
      // providers, the Sleeper schemas, and most services outside the gate
      // entirely. UI stays out — it is covered by the Playwright suite.
      include: [
        "src/services/**/*.ts",
        "src/providers/**/*.ts",
        "src/schemas/**/*.ts",
      ],
      exclude: ["**/*.d.ts"],
      // Set just under the measured baseline (76.59/65.11/77.18/78.90 over
      // 3,785 statements) so this ratchets upward without failing on variance.
      thresholds: {
        statements: 75,
        branches: 63,
        functions: 75,
        lines: 77,
      },
    },
  },
});
