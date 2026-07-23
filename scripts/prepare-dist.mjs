import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, ".output", "chrome-mv3");
const destination = resolve(root, "dist");

if (!destination.startsWith(`${root}${sep}`)) {
  throw new Error(
    "Refusing to prepare a dist directory outside the repository.",
  );
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });

const files = await collectFiles(destination);
const sourceMaps = files.filter((file) => file.endsWith(".map"));
if (sourceMaps.length > 0) {
  throw new Error(
    `Production source maps are not allowed: ${sourceMaps.join(", ")}`,
  );
}
console.log(
  `Prepared dist with ${files.length} files and no production source maps.`,
);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(directory, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
    }),
  );
  return paths.flat();
}
