import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const vitest = resolve(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(
  process.execPath,
  [
    vitest,
    "run",
    "tests/simulations/simulation-harness.test.ts",
    "-t",
    "exhaustive",
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, PHASE2_EXHAUSTIVE: "1" },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
