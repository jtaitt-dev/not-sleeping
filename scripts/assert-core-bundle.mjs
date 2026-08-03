import { readFile, readdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultCore = resolve(root, "dist", "core");
const forbidden = [
  "parlay lab",
  "american odds",
  "sportsbook",
  "expectedreturnindex",
  "analyzemanualparlayscenario",
  "jurisdictionconfirmed",
];

export async function assertCoreBundle(coreDirectory = defaultCore) {
  if (!coreDirectory.startsWith(`${root}${sep}`)) {
    throw new Error("Refusing to inspect a bundle outside the repository.");
  }
  const files = await collectFiles(coreDirectory);
  const violations = [];
  for (const file of files.filter((path) =>
    /\.(?:css|html|js|json|txt)$/i.test(path),
  )) {
    const text = (await readFile(file, "utf8")).toLowerCase();
    for (const token of forbidden) {
      if (text.includes(token)) violations.push(`${file}: ${token}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `Core bundle contains Labs-only betting code:\n${violations.join("\n")}`,
    );
  }
  return { files: files.length, forbiddenTokens: forbidden.length };
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

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await assertCoreBundle();
  console.log(
    `Core bundle exclusion passed across ${result.files} files (${result.forbiddenTokens} Labs-only tokens).`,
  );
}
