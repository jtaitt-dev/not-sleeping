import { describe, expect, it } from "vitest";

import { sleeperDraftSchema } from "@/schemas/sleeper";
import {
  parseSleeperRoute,
  type SleeperRouteContext,
} from "@/services/context/route-detection";
import { resolveDraftLeagueId } from "@/services/context/live-draft-state";

/**
 * URL shapes and payload shapes captured from a signed-in Sleeper account,
 * including a real mock draft. Mock drafts are the only surface that produces
 * `league_id: null`, which drives a different branch in loadLiveDraft than any
 * league-backed draft.
 */

const LEAGUE = "1265107146211606528";
const DRAFT = "1389680932197257216";

describe("route detection against real Sleeper URLs", () => {
  const cases: Array<[string, Partial<SleeperRouteContext>]> = [
    // Mock draft — the /draft/nfl/<id> form the "nfl" segment skip exists for.
    [
      `https://sleeper.com/draft/nfl/${DRAFT}`,
      { supported: true, route: "draft", draftId: DRAFT },
    ],
    [
      `https://sleeper.com/leagues/${LEAGUE}/team`,
      { supported: true, route: "team", leagueId: LEAGUE },
    ],
    [
      `https://sleeper.com/leagues/${LEAGUE}/matchup`,
      { supported: true, route: "matchup", leagueId: LEAGUE },
    ],
    [
      `https://sleeper.com/leagues/${LEAGUE}/players`,
      { supported: true, route: "players", leagueId: LEAGUE },
    ],
    // Pre-draft lobby: league-scoped, and "predraft" must not be read as a draft.
    [
      `https://sleeper.com/leagues/${LEAGUE}/predraft`,
      { supported: true, route: "league", leagueId: LEAGUE },
    ],
    [`https://sleeper.com/draftboards`, { supported: true, route: "home" }],
    [`https://sleeper.com/leagues`, { supported: true, route: "home" }],
    [`https://example.com/draft/nfl/${DRAFT}`, { supported: false }],
  ];

  it.each(cases)("classifies %s", (url, expected) => {
    expect(parseSleeperRoute(url)).toMatchObject(expected);
  });

  it("never leaks a query string or fragment into the sanitized URL", () => {
    const route = parseSleeperRoute(
      `https://sleeper.com/leagues/${LEAGUE}/team?invite=secret#tok`,
    );
    expect(route.sanitizedUrl).toBe(
      `https://sleeper.com/leagues/${LEAGUE}/team`,
    );
    expect(route.sanitizedUrl).not.toContain("secret");
    expect(route.sanitizedUrl).not.toContain("tok");
  });
});

describe("mock draft payloads", () => {
  // Field-for-field shape of a real pre-draft mock draft.
  const mockDraftPayload = {
    draft_id: DRAFT,
    league_id: null,
    type: "snake",
    status: "pre_draft",
    season: "2026",
    sport: "nfl",
    start_time: null,
    last_picked: null,
    draft_order: null,
    slot_to_roster_id: {},
    settings: { teams: 10, rounds: 15 },
    metadata: { scoring_type: "std" },
  };

  it("parses a mock draft with a null league and null ordering", () => {
    const draft = sleeperDraftSchema.parse(mockDraftPayload);
    expect(draft.league_id).toBeNull();
    expect(draft.draft_order).toBeNull();
    expect(draft.settings["teams"]).toBe(10);
  });

  it("resolves no league id for a mock draft", () => {
    const draft = sleeperDraftSchema.parse(mockDraftPayload);
    // loadLiveDraft skips league/users/rosters on undefined; a throw or a
    // stringified "null" here would fan out into bad Sleeper requests.
    expect(resolveDraftLeagueId(draft)).toBeUndefined();
  });

  it("falls back to a league id carried in draft metadata", () => {
    const draft = sleeperDraftSchema.parse({
      ...mockDraftPayload,
      metadata: { league_id: LEAGUE },
    });
    expect(resolveDraftLeagueId(draft)).toBe(LEAGUE);
  });

  it("tolerates null draft metadata", () => {
    // metadata feeds resolveDraftLeagueId's index access, so a null here used
    // to throw before the container fix.
    const draft = sleeperDraftSchema.parse({
      ...mockDraftPayload,
      metadata: null,
    });
    expect(draft.metadata).toEqual({});
    expect(resolveDraftLeagueId(draft)).toBeUndefined();
  });
});
