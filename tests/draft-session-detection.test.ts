import { describe, expect, it } from "vitest";

import { sleeperDraftSchema } from "@/schemas/sleeper";
import { detectDraftSession } from "@/services/draft/session-detection";

describe("draft session detection", () => {
  it("classifies a Sleeper league draft from the direct league link", () => {
    const result = detectDraftSession({
      draft: sleeperDraftSchema.parse({
        draft_id: "league-draft-1",
        league_id: "league-1",
        type: "snake",
        status: "pre_draft",
        season: "2026",
        settings: { teams: 12 },
        metadata: {},
      }),
    });

    expect(result).toMatchObject({
      kind: "league_draft",
      sourceLeagueId: "league-1",
      overridden: false,
    });
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("detects the Big Bucks league mock without treating it as a league draft", () => {
    const result = detectDraftSession({
      draft: sleeperDraftSchema.parse({
        draft_id: "big-bucks-rookie-2026",
        league_id: null,
        type: "linear",
        status: "pre_draft",
        season: "2026",
        settings: { teams: 16, rounds: 3, player_type: 1, cpu_autopick: 1 },
        metadata: { league_id: "big-bucks", name: "Big Bucks Rookie Mock" },
        creators: ["user-8"],
      }),
      routeUrl: "https://sleeper.com/draft/nfl/mock-draft-big-bucks",
    });

    expect(result).toMatchObject({
      kind: "league_mock",
      sourceLeagueId: "big-bucks",
      overridden: false,
    });
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("distinguishes a standalone mock with no source league", () => {
    const result = detectDraftSession({
      draft: sleeperDraftSchema.parse({
        draft_id: "standalone-mock",
        league_id: null,
        type: "snake",
        status: "pre_draft",
        season: "2026",
        settings: { teams: 10 },
        metadata: {},
        creators: ["user-1"],
      }),
      routeUrl: "https://sleeper.com/draft/nfl/mock-draft-1234",
    });

    expect(result.kind).toBe("standalone_mock");
    expect(result.sourceLeagueId).toBeUndefined();
  });

  it("honors a persisted per-draft correction and preserves the source league", () => {
    const result = detectDraftSession({
      draft: sleeperDraftSchema.parse({
        draft_id: "corrected",
        league_id: null,
        type: "snake",
        status: "pre_draft",
        season: "2026",
        settings: {},
        metadata: { league_id: "source-league" },
      }),
      override: "standalone_mock",
    });

    expect(result).toEqual({
      kind: "standalone_mock",
      confidence: 1,
      evidence: ["Saved correction for this draft"],
      sourceLeagueId: "source-league",
      overridden: true,
    });
  });
});
