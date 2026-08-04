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
      // One point under the measured baseline (76.59/65.11/77.18/78.90 over
      // 3,785 statements). v8 coverage is deterministic for a given
      // code + test set, so the gap is not absorbing run-to-run variance — it
      // only tolerates a small refactor. One point is roughly 38 statements;
      // anything larger landing uncovered should fail here. Raise these
      // alongside any change that improves the numbers.
      thresholds: {
        statements: 76,
        branches: 64,
        functions: 76,
        lines: 78,
      },
    },
  },
});
