import { describe, expect, it } from "vitest";

import {
  sleeperLeagueSchema,
  sleeperLeagueUserSchema,
  sleeperMatchupSchema,
  sleeperProjectionSchema,
  sleeperRosterSchema,
  sleeperTransactionSchema,
  sleeperUserSchema,
} from "@/schemas/sleeper";

/**
 * Sleeper sends an explicit `null` — not an omitted key — for empty maps, empty
 * lists, and unset flags. Zod's `.default()`/`.optional()` only fire on
 * `undefined`, so these fields used to throw on ordinary league payloads and
 * took down every workspace that depends on GET_LEAGUE_SNAPSHOT.
 *
 * Field/count annotations below are live observations from six real leagues.
 */
describe("Sleeper schemas tolerate null containers", () => {
  it("parses a roster with null metadata and null owner", () => {
    const parsed = sleeperRosterSchema.parse({
      roster_id: 1,
      owner_id: null,
      league_id: "L1",
      players: null,
      starters: null,
      reserve: null,
      taxi: null,
      co_owners: null,
      settings: null,
      metadata: null, // observed x46
    });
    expect(parsed.settings).toEqual({});
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.owner_id).toBeNull();
  });

  it("parses a transaction with null settings, metadata and consenter_ids", () => {
    const parsed = sleeperTransactionSchema.parse({
      transaction_id: "T1",
      type: "waiver",
      status: "complete",
      creator: null,
      roster_ids: null,
      consenter_ids: null, // observed x7
      adds: null,
      drops: null,
      draft_picks: null,
      waiver_budget: null,
      settings: null, // observed x383
      metadata: null, // observed x384
    });
    expect(parsed.settings).toEqual({});
    expect(parsed.metadata).toEqual({});
    expect(parsed.roster_ids).toEqual([]);
    expect(parsed.consenter_ids).toEqual([]);
    expect(parsed.draft_picks).toEqual([]);
    expect(parsed.waiver_budget).toEqual([]);
  });

  it("parses a league user with a null is_owner flag", () => {
    const parsed = sleeperLeagueUserSchema.parse({
      user_id: "U1",
      is_owner: null, // observed x39
      metadata: null,
    });
    expect(parsed.is_owner).toBeUndefined();
  });

  it("parses a league with null settings, scoring and metadata", () => {
    const parsed = sleeperLeagueSchema.parse({
      league_id: "L1",
      season: "2025",
      settings: null,
      scoring_settings: null,
      roster_positions: null,
      metadata: null, // observed x1
    });
    expect(parsed.settings).toEqual({});
    expect(parsed.scoring_settings).toEqual({});
    expect(parsed.roster_positions).toEqual([]);
    expect(parsed.metadata).toBeUndefined();
  });

  it("parses a user, matchup and projection with null maps", () => {
    expect(
      sleeperUserSchema.parse({ user_id: "U1", metadata: null }).metadata,
    ).toBeUndefined();
    expect(
      sleeperMatchupSchema.parse({ roster_id: 1, players_points: null })
        .players_points,
    ).toEqual({});
    expect(
      sleeperProjectionSchema.parse({ player_id: "P1", stats: null }).stats,
    ).toEqual({});
  });

  it("still applies defaults when a key is omitted entirely", () => {
    const parsed = sleeperRosterSchema.parse({ roster_id: 1, league_id: "L1" });
    expect(parsed.settings).toEqual({});
    expect(parsed.metadata).toBeUndefined();
  });
});
