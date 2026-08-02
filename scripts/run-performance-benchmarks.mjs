import { spawn } from "node:child_process";

const isCi = process.argv.includes("--ci");
const pnpmArguments = [
  "exec",
  "vitest",
  "run",
  "--config",
  "vitest.performance.config.ts",
  "--reporter=verbose",
];
const pnpmCli = process.env.npm_execpath;
const command = pnpmCli ? process.execPath : "pnpm";
const args = pnpmCli ? [pnpmCli, ...pnpmArguments] : pnpmArguments;

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PERFORMANCE_CI: isCi ? "true" : "false",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start performance benchmarks: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Performance benchmarks stopped by ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
