import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const expectedTag = `v${packageJson.version}`;
const actualTag = process.env.GITHUB_REF_NAME;

if (!actualTag) {
  throw new Error("GITHUB_REF_NAME is required for release verification.");
}
if (actualTag !== expectedTag) {
  throw new Error(
    `Release tag ${actualTag} does not match package version ${expectedTag}.`,
  );
}

console.log(`Verified release version ${expectedTag}.`);
