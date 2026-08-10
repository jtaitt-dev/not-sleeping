import { beforeEach, describe, expect, it } from "vitest";

import {
  hasPlayerHeadshotFailed,
  markPlayerHeadshotFailed,
  resetFailedPlayerHeadshots,
  resolvePlayerHeadshot,
} from "@/services/players/player-headshots";

describe("player headshot resolver", () => {
  beforeEach(resetFailedPlayerHeadshots);

  it("builds the verified Sleeper CDN URL from a safe Sleeper player id", () => {
    expect(
      resolvePlayerHeadshot({
        id: "11565",
        sleeperId: "11565",
        position: "TE",
      }),
    ).toBe("https://sleepercdn.com/content/nfl/players/thumb/11565.jpg");
    expect(
      resolvePlayerHeadshot(
        { id: "11565", sleeperId: "11565", position: "TE" },
        "full",
      ),
    ).toBe("https://sleepercdn.com/content/nfl/players/11565.jpg");
  });

  it("uses deterministic fallbacks for team defenses and unsafe ids", () => {
    expect(resolvePlayerHeadshot({ id: "ATL", position: "DEF" })).toBeNull();
    expect(
      resolvePlayerHeadshot({ id: "../secret", position: "WR" }),
    ).toBeNull();
    expect(
      resolvePlayerHeadshot({ id: "demo-rookie-1", position: "QB" }),
    ).toBeNull();
  });

  it("memoizes failed URLs for the rest of the extension session", () => {
    const player = { id: "11565", position: "TE" as const };
    const url = resolvePlayerHeadshot(player);
    expect(url).not.toBeNull();
    markPlayerHeadshotFailed(url!);
    expect(hasPlayerHeadshotFailed(url!)).toBe(true);
    expect(resolvePlayerHeadshot(player)).toBeNull();
  });
});
