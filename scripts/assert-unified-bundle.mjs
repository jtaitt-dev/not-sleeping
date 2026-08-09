import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const manifestPath = resolve(dist, "manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.name !== "Not Sleeping") {
  throw new Error(`Unexpected manifest name: ${String(manifest.name)}`);
}
const permissions = new Set(manifest.permissions ?? []);
for (const excessive of ["activeTab", "tabs"]) {
  if (permissions.has(excessive)) {
    throw new Error(
      `Production manifest contains excessive ${excessive} permission.`,
    );
  }
}
const mandatoryHosts = new Set(manifest.host_permissions ?? []);
const optionalHosts = new Set(manifest.optional_host_permissions ?? []);
for (const aiOrigin of [
  "https://api.openai.com/*",
  "https://api.anthropic.com/*",
]) {
  if (mandatoryHosts.has(aiOrigin) || !optionalHosts.has(aiOrigin)) {
    throw new Error(
      `AI origin must be optional and absent from mandatory hosts: ${aiOrigin}`,
    );
  }
}
for (const obsoleteDirectory of ["core", "labs"]) {
  if (await exists(resolve(dist, obsoleteDirectory))) {
    throw new Error(`Obsolete split build found at dist/${obsoleteDirectory}.`);
  }
}

const files = await collectFiles(dist);
if (files.some((file) => file.endsWith(".map"))) {
  throw new Error("Production source maps must not be shipped.");
}
const scriptText = (
  await Promise.all(
    files
      .filter((file) => /\.(?:js|html|json)$/.test(file))
      .map((file) => readFile(file, "utf8")),
  )
).join("\n");
for (const requiredToken of ["Advanced Research", "Manual Odds Research"]) {
  if (!scriptText.includes(requiredToken)) {
    throw new Error(`Unified bundle is missing ${requiredToken}.`);
  }
}
for (const obsoleteToken of [
  "Not Sleeping Labs",
  "Labs sideload build",
  "virtual:not-sleeping-labs-workspace",
]) {
  if (scriptText.includes(obsoleteToken)) {
    throw new Error(`Unified bundle contains obsolete token: ${obsoleteToken}`);
  }
}

console.log(`Unified bundle assertion passed across ${files.length} files.`);

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

async function exists(path) {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}
