import { beforeEach, describe, expect, it } from "vitest";

import {
  hasPlayerHeadshotFailed,
  markPlayerHeadshotFailed,
  resetFailedPlayerHeadshots,
  resolvePlayerHeadshot,
  resolvePlayerHeadshotCandidates,
} from "@/services/players/player-headshots";
import { DEMO_PLAYERS } from "@/services/demo/fixtures";

describe("player headshot resolver", () => {
  beforeEach(resetFailedPlayerHeadshots);

  it("builds the verified Sleeper CDN URL from a safe Sleeper player id", () => {
    expect(
      resolvePlayerHeadshot({
        id: "11604",
        sleeperId: "11604",
        position: "TE",
      }),
    ).toBe("https://sleepercdn.com/content/nfl/players/thumb/11604.jpg");
    expect(
      resolvePlayerHeadshot(
        { id: "11604", sleeperId: "11604", position: "TE" },
        "full",
      ),
    ).toBe("https://sleepercdn.com/content/nfl/players/11604.jpg");
    expect(
      resolvePlayerHeadshotCandidates(
        { id: "11604", sleeperId: "11604", position: "TE" },
        "full",
      ),
    ).toEqual([
      "https://sleepercdn.com/content/nfl/players/11604.jpg",
      "https://sleepercdn.com/content/nfl/players/thumb/11604.jpg",
    ]);
  });

  it("requires an explicit verified Sleeper id and fails closed otherwise", () => {
    expect(resolvePlayerHeadshot({ id: "ATL", position: "DEF" })).toBeNull();
    expect(resolvePlayerHeadshot({ id: "11604", position: "TE" })).toBeNull();
    expect(
      resolvePlayerHeadshot({
        id: "../secret",
        sleeperId: "../secret",
        position: "WR",
      }),
    ).toBeNull();
    expect(
      resolvePlayerHeadshot({
        id: "demo-rookie-1",
        sleeperId: "demo-rookie-1",
        position: "QB",
      }),
    ).toBeNull();
  });

  it("falls back between verified image sizes and memoizes failed URLs", () => {
    const player = {
      id: "11604",
      sleeperId: "11604",
      position: "TE" as const,
    };
    const url = resolvePlayerHeadshot(player);
    expect(url).not.toBeNull();
    markPlayerHeadshotFailed(url!);
    expect(hasPlayerHeadshotFailed(url!)).toBe(true);
    expect(resolvePlayerHeadshot(player)).toBe(
      "https://sleepercdn.com/content/nfl/players/11604.jpg",
    );
    markPlayerHeadshotFailed(resolvePlayerHeadshot(player)!);
    expect(resolvePlayerHeadshot(player)).toBeNull();
  });

  it("pins every bundled active player to the canonical Sleeper identity", () => {
    const expectedIds: Record<string, string> = {
      "Malik Nabers": "11632",
      "Brock Bowers": "11604",
      "Bijan Robinson": "9509",
      "Jaxon Smith-Njigba": "9488",
      "Caleb Williams": "11560",
      "Rome Odunze": "11620",
      "Trey McBride": "8130",
      "George Pickens": "8137",
      "Kenneth Walker III": "8151",
      "Drake London": "8112",
      "Ja'Marr Chase": "7564",
      "Breece Hall": "8155",
      "Jayden Daniels": "11566",
      "Brian Thomas Jr.": "11631",
      "Xavier Worthy": "11624",
      "Bucky Irving": "11584",
      "Marvin Harrison Jr.": "11628",
      "Trey Benson": "11589",
    };

    for (const [fullName, sleeperId] of Object.entries(expectedIds)) {
      const player = DEMO_PLAYERS.find((entry) => entry.fullName === fullName);
      expect(player, fullName).toBeDefined();
      expect(player?.id, fullName).toBe(sleeperId);
      expect(player?.sleeperId, fullName).toBe(sleeperId);
      expect(resolvePlayerHeadshot(player!), fullName).toContain(
        `/thumb/${sleeperId}.jpg`,
      );
    }
  });
});
