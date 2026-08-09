import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, ".output");
const artifacts = resolve(root, "artifacts");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);

await mkdir(artifacts, { recursive: true });
const before = await zipTimestamps();
await runWxt(["zip"]);
const generated = await newestGeneratedZip(before);
const archiveName = `not-sleeping-${packageJson.version}.zip`;
const archivePath = resolve(artifacts, archiveName);
await copyFile(generated, archivePath);
const checksum = createHash("sha256")
  .update(await readFile(archivePath))
  .digest("hex");
await writeFile(
  resolve(artifacts, `not-sleeping-${packageJson.version}.sha256`),
  `${checksum}  ${basename(archivePath)}\n`,
  "utf8",
);
console.log(`Packaged ${archiveName}`);
console.log(`SHA-256 ${checksum}`);

async function zipTimestamps() {
  const entries = await readdir(output).catch(() => []);
  return new Map(
    await Promise.all(
      entries
        .filter((file) => file.endsWith(".zip"))
        .map(async (file) => [
          file,
          (await stat(resolve(output, file))).mtimeMs,
        ]),
    ),
  );
}

async function newestGeneratedZip(before) {
  const entries = await readdir(output);
  const candidates = await Promise.all(
    entries
      .filter((file) => file.endsWith(".zip") && file.includes("chrome"))
      .map(async (file) => ({
        file,
        modified: (await stat(resolve(output, file))).mtimeMs,
      })),
  );
  const changed = candidates
    .filter((entry) => entry.modified > (before.get(entry.file) ?? 0))
    .sort((left, right) => right.modified - left.modified)[0];
  if (!changed)
    throw new Error("WXT did not produce a fresh Chrome ZIP archive.");
  return resolve(output, changed.file);
}

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
