import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

/**
 * verify-version.mjs only compares the release tag to package.json. The
 * manifest version used to be hardcoded separately in wxt.config.ts, so a
 * version bump could pass the release gate while shipping an extension that
 * reported the previous version.
 */
describe("extension version has a single source of truth", () => {
  it("does not hardcode a manifest version in the WXT config", () => {
    const config = read("wxt.config.ts");
    expect(config).not.toMatch(/version:\s*["']\d+\.\d+\.\d+["']/);
  });

  it("declares a semver version in package.json", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("records the current version in the changelog", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(read("CHANGELOG.md")).toContain(`## [${pkg.version}]`);
  });
});
