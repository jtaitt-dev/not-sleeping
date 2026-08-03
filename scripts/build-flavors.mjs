import { spawn } from "node:child_process";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { assertCoreBundle } from "./assert-core-bundle.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const output = resolve(root, ".output", "chrome-mv3");
const requestedFlavor = process.argv[2];
if (requestedFlavor && !["core", "labs"].includes(requestedFlavor)) {
  throw new Error(`Unknown build flavor: ${requestedFlavor}`);
}
const flavors = requestedFlavor ? [requestedFlavor] : ["core", "labs"];

if (!dist.startsWith(`${root}${sep}`)) {
  throw new Error("Refusing to prepare dist outside the repository.");
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const flavor of flavors) {
  await runWxt(["build"], {
    ...process.env,
    NOT_SLEEPING_BUILD_FLAVOR: flavor,
  });
  const destination = resolve(dist, flavor);
  await mkdir(destination, { recursive: true });
  await cp(output, destination, { recursive: true });
  const files = await collectFiles(destination);
  const sourceMaps = files.filter((file) => file.endsWith(".map"));
  if (sourceMaps.length > 0) {
    throw new Error(
      `Production source maps are not allowed: ${sourceMaps.join(", ")}`,
    );
  }
  console.log(`Prepared ${flavor} build with ${files.length} files.`);
}

if (flavors.includes("core")) {
  const exclusion = await assertCoreBundle();
  console.log(`Core bundle exclusion passed across ${exclusion.files} files.`);
  await mirrorCoreForDevelopment();
  console.log(
    "Mirrored Core files at dist/ for existing unpacked Chrome installs.",
  );
}

function runWxt(args, env) {
  const cli = resolve(root, "node_modules", "wxt", "bin", "wxt.mjs");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      env,
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

async function mirrorCoreForDevelopment() {
  const core = resolve(dist, "core");
  const entries = await readdir(core, { withFileTypes: true });
  for (const entry of entries) {
    const source = resolve(core, entry.name);
    const destination = resolve(dist, entry.name);
    if (
      destination === resolve(dist, "core") ||
      destination === resolve(dist, "labs")
    ) {
      continue;
    }
    await cp(source, destination, { recursive: true });
  }
}
