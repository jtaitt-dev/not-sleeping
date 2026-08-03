import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifacts = resolve(root, "artifacts");
const rawReport = resolve(artifacts, "ai-eval-vitest.json");
await mkdir(artifacts, { recursive: true });

await runVitest([
  "run",
  "tests/evals/ai-evals.test.ts",
  "--reporter=json",
  `--outputFile=${rawReport}`,
]);

const raw = JSON.parse(await readFile(rawReport, "utf8"));
await rm(rawReport, { force: true });
const passed = Number(raw.numPassedTests ?? 0);
const failed = Number(raw.numFailedTests ?? 0);
const total = Number(raw.numTotalTests ?? passed + failed);
const report = {
  generatedAt: new Date().toISOString(),
  mode: "mocked-and-deterministic",
  credentialsRequired: false,
  fixtures: total,
  passed,
  failed,
  passRate: total === 0 ? 0 : passed / total,
  checks: [
    "legal candidate preservation",
    "state-hash determinism",
    "score bounds",
    "confidence bounds",
  ],
};
await writeFile(
  resolve(artifacts, "ai-eval-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(artifacts, "ai-eval-report.md"),
  [
    "# AI evaluation report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Mode: ${report.mode}`,
    `- Credentials required: ${report.credentialsRequired ? "yes" : "no"}`,
    `- Fixtures: ${report.fixtures}`,
    `- Passed: ${report.passed}`,
    `- Failed: ${report.failed}`,
    `- Pass rate: ${(report.passRate * 100).toFixed(1)}%`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check}`),
    "",
  ].join("\n"),
  "utf8",
);
console.log(`AI evals: ${passed}/${total} passed.`);

function runVitest(args) {
  const cli = resolve(root, "node_modules", "vitest", "vitest.mjs");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`AI evals exited with ${code}.`));
    });
  });
}
