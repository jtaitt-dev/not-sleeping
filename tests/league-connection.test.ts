import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createMessage, messageSchema } from "@/services/messaging/protocol";

const src = (path: string) =>
  readFileSync(resolve(import.meta.dirname, "..", "src", path), "utf8");

/**
 * The league catalog is gated on settings.sleeperUserId, which only
 * RESOLVE_USER can populate. The handler and the schema both existed, but no
 * UI ever called it, so the id stayed empty forever and every workspace fell
 * back to demo data. These guard the wiring, not just the pieces.
 */
describe("Sleeper account connection is reachable from the UI", () => {
  it("has a caller for RESOLVE_USER outside the protocol and worker", () => {
    const options = src("entrypoints/options/main.tsx");
    expect(options).toContain("RESOLVE_USER");
  });

  it("syncs the league catalog once an account resolves", () => {
    // Resolving an id without loading leagues leaves the switcher empty,
    // which is indistinguishable from "still on demo data".
    const options = src("entrypoints/options/main.tsx");
    const connect = options.slice(options.indexOf("connectSleeperAccount"));
    expect(connect).toContain("SYNC_LEAGUES");
  });

  it("does not hardcode a season or week when syncing", () => {
    // Week 1 was wrong for most of the year, and the calendar year is the
    // wrong season during the offseason.
    const store = src("stores/league-store.ts");
    expect(store).not.toContain("getFullYear()");
    expect(store).not.toMatch(/week:\s*1\b/);
  });
});

describe("SYNC_LEAGUES resolves its own window", () => {
  it("accepts a payload carrying only the user id", () => {
    const message = createMessage({
      type: "SYNC_LEAGUES",
      payload: { userId: "1000812128841850880" },
    });
    expect(message.type).toBe("SYNC_LEAGUES");
    expect(messageSchema.parse(message)).toMatchObject({
      payload: { userId: "1000812128841850880" },
    });
  });

  it("still accepts an explicit season and week", () => {
    const message = createMessage({
      type: "SYNC_LEAGUES",
      payload: { userId: "1", seasons: ["2026", "2025"], week: 4 },
    });
    expect(message).toMatchObject({
      payload: { seasons: ["2026", "2025"], week: 4 },
    });
  });

  it("rejects a malformed season", () => {
    expect(() =>
      createMessage({
        type: "SYNC_LEAGUES",
        payload: { userId: "1", seasons: ["twenty-six"] },
      }),
    ).toThrow();
  });

  it("asks the worker for every season it is allowed to request", () => {
    // "All my leagues" means every season the account could have played;
    // Sleeper's league endpoint is per-season and returns [] for empty ones.
    const background = src("entrypoints/background.ts");
    const cap = /MAX_SYNC_SEASONS = (\d+)/.exec(background)?.[1];
    expect(cap).toBeDefined();
    const seasons = messageSchema.options
      .map((option) => option.shape.type.value as string)
      .filter((type) => type === "SYNC_LEAGUES");
    expect(seasons).toHaveLength(1);
    // The worker must not request more seasons than the protocol permits.
    expect(Number(cap)).toBeLessThanOrEqual(8);
    expect(Number(cap)).toBeGreaterThanOrEqual(4);
  });
});
