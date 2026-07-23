import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, ".output");
const artifacts = resolve(root, "artifacts");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const files = await readdir(output);
const generated = files
  .filter((file) => file.endsWith(".zip") && file.includes("chrome"))
  .toSorted()
  .at(-1);

if (!generated) throw new Error("WXT did not produce a Chrome ZIP archive.");

await mkdir(artifacts, { recursive: true });
const archiveName = `not-sleeping-${packageJson.version}.zip`;
const archivePath = resolve(artifacts, archiveName);
await copyFile(resolve(output, generated), archivePath);
const bytes = await readFile(archivePath);
const checksum = createHash("sha256").update(bytes).digest("hex");
await writeFile(
  resolve(artifacts, `not-sleeping-${packageJson.version}.sha256`),
  `${checksum}  ${basename(archivePath)}\n`,
  "utf8",
);
console.log(`Packaged ${archiveName}`);
console.log(`SHA-256 ${checksum}`);
