import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (path: string) =>
  readFileSync(resolve(import.meta.dirname, "..", "src", path), "utf8");

/**
 * Connecting an account was originally only possible from the extension
 * options page, a separate tab. The side panel has its own Settings workspace,
 * which is where people actually look, and it offered nothing — while the
 * league empty state told them to "connect a Sleeper username in Settings".
 * Being reachable matters as much as existing.
 */
describe("connecting a Sleeper account is discoverable in the side panel", () => {
  const panel = src("features/workspaces/all-workspaces.tsx");

  it("offers the connect action from the panel settings workspace", () => {
    const settings = panel.slice(
      panel.indexOf("export function SettingsWorkspace"),
    );
    expect(settings).toContain("RESOLVE_USER");
    expect(settings).toContain("Sleeper account");
  });

  it("loads the league catalog as part of connecting", () => {
    // Resolving an id without syncing leaves the switcher empty, which reads
    // to the user as "still broken".
    const settings = panel.slice(panel.indexOf("connectSleeperAccount"));
    expect(settings).toMatch(/sync\(\)/);
  });

  it("does not send people to a screen with no connect control", () => {
    const season = src("features/season/full-season-workspaces.tsx");
    // The old copy pointed at "Settings" ambiguously; the panel workspace is
    // now the place that can actually do it.
    expect(season).not.toContain("Connect a Sleeper username in Settings,");
  });
});
