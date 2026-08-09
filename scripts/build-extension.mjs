import { spawn } from "node:child_process";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const output = resolve(root, ".output", "chrome-mv3");

if (!dist.startsWith(`${root}${sep}`)) {
  throw new Error("Refusing to prepare dist outside the repository.");
}

await rm(dist, { recursive: true, force: true });
await runWxt(["build"]);
await mkdir(dist, { recursive: true });
await cp(output, dist, { recursive: true });

const files = await collectFiles(dist);
const sourceMaps = files.filter((file) => file.endsWith(".map"));
if (sourceMaps.length > 0) {
  throw new Error(
    `Production source maps are not allowed: ${sourceMaps.join(", ")}`,
  );
}
console.log(`Prepared unified build with ${files.length} files.`);

function runWxt(args) {
  const cli = resolve(root, "node_modules", "wxt", "bin", "wxt.mjs");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`wxt ${args.join(" ")} exited with ${code}.`));
    });
  });
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = resolve(directory, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
    }),
  );
  return nested.flat();
}
