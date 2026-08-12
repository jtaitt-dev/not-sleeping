import { describe, expect, it } from "vitest";

import { buildLeagueOverview } from "@/features/season/league-overview";
import type { LeagueSnapshot } from "@/stores/league-store";
import type { Player } from "@/types/domain";
import type { LeagueContext } from "@/types/league";

describe("selected league overview projection", () => {
  it("projects canonical draft positions, standings, activity, and settings", () => {
    const view = buildLeagueOverview(context(), snapshot());

    expect(view).not.toBeNull();
    expect(view?.members).toEqual([
      expect.objectContaining({
        rosterId: 1,
        teamName: "Night Shift",
        ownerName: "Joshua",
        avatarUrl: "https://sleepercdn.com/avatars/avatar-one",
        draftPosition: 2,
        isUser: true,
      }),
      expect.objectContaining({
        rosterId: 2,
        teamName: "Sunday Crew",
        avatarUrl: null,
        draftPosition: 1,
        isUser: false,
      }),
    ]);
    expect(view?.standings).toEqual([
      expect.objectContaining({
        rank: 1,
        rosterId: 2,
        wins: 7,
        losses: 2,
        pointsFor: 1_301.07,
        pointsAgainst: 1_002.11,
        waiverLabel: "$70 · #2",
      }),
      expect.objectContaining({ rank: 2, rosterId: 1 }),
    ]);
    expect(view?.activity.map((item) => item.id)).toEqual([
      "new-add",
      "old-drop",
    ]);
    expect(view?.activity[0]).toMatchObject({
      actorName: "Sunday Manager",
      teamName: "Sunday Crew",
      label: "Added a player",
      moves: [
        {
          kind: "add",
          playerName: "Available Runner",
          position: "RB",
          team: "BUF",
        },
      ],
    });
    expect(view?.settings).toEqual(
      expect.arrayContaining([
        { label: "Number of Teams", value: "2" },
        { label: "Injured Reserve Slots", value: "3" },
        { label: "Taxi Slots", value: "4" },
        { label: "Draft Pick Trading Allowed", value: "Yes" },
      ]),
    );
  });

  it("uses waiver order for non-FAAB leagues", () => {
    const rolling = buildLeagueOverview(
      { ...context(), waiverType: "rolling" },
      snapshot(),
    );

    expect(
      rolling?.standings.find((standing) => standing.rosterId === 2),
    ).toMatchObject({ waiverLabel: "#2" });
  });

  it("rejects every cross-league snapshot boundary", () => {
    const stale = snapshot();
    stale.leagueId = "previous-league";
    expect(buildLeagueOverview(context(), stale)).toBeNull();

    const mismatchedLeague = snapshot();
    mismatchedLeague.league.league_id = "previous-league";
    expect(buildLeagueOverview(context(), mismatchedLeague)).toBeNull();
  });
});

function context(): LeagueContext {
  return {
    leagueId: "connected-league",
    leagueName: "Connected League",
    season: "2026",
    week: 1,
    userId: "user-one",
    rosterId: 1,
    leagueType: "dynasty",
    lineupType: "classic",
    draftStyle: "snake",
    waiverType: "faab_with_rolling_tiebreak",
    weeklyElimination: false,
    eliminationTiebreaker: null,
    rosterPositions: ["QB", "RB", "WR", "TE", "BN", "IR", "TAXI"],
    scoringSettings: { pass_td: 4, rec: 1 },
    settings: {
      waiver_budget: 100,
      playoff_teams: 6,
      playoff_week_start: 15,
      trade_deadline: 11,
      reserve_slots: 3,
      taxi_slots: 4,
      pick_trading: 1,
    },
    strategy: "balanced",
    selectedMatchupId: null,
    dataFreshness: {},
  };
}

function snapshot(): LeagueSnapshot {
  return {
    userId: "user-one",
    leagueId: "connected-league",
    week: 1,
    fetchedAt: 1_786_484_800_000,
    league: {
      league_id: "connected-league",
      name: "Connected League",
      season: "2026",
      sport: "nfl",
      total_rosters: 2,
      draft_id: "current-draft",
      avatar: "league-avatar",
      settings: {},
      scoring_settings: {},
      roster_positions: [],
    },
    users: [
      {
        user_id: "user-one",
        username: "joshua",
        display_name: "Joshua",
        avatar: "avatar-one",
        metadata: { team_name: "Night Shift" },
      },
      {
        user_id: "user-two",
        username: "sunday-manager",
        display_name: "Sunday Manager",
        avatar: "https://example.com/not-allowed.png",
        metadata: { team_name: "Sunday Crew" },
      },
    ],
    rosters: [
      {
        roster_id: 1,
        owner_id: "user-one",
        league_id: "connected-league",
        players: [],
        starters: [],
        settings: {
          wins: 6,
          losses: 3,
          fpts: 1_250,
          fpts_decimal: 45,
          fpts_against: 1_100,
          fpts_against_decimal: 9,
          waiver_budget_used: 10,
          waiver_position: 1,
        },
        metadata: {},
      },
      {
        roster_id: 2,
        owner_id: "user-two",
        league_id: "connected-league",
        players: [],
        starters: [],
        settings: {
          wins: 7,
          losses: 2,
          fpts: 1_301,
          fpts_decimal: 7,
          fpts_against: 1_002,
          fpts_against_decimal: 11,
          waiver_budget_used: 30,
          waiver_position: 2,
        },
        metadata: {},
      },
    ],
    matchups: [],
    transactions: [
      {
        transaction_id: "old-drop",
        type: "free_agent",
        status: "complete",
        creator: "user-one",
        created: 1_786_480_000,
        roster_ids: [1],
        consenter_ids: [],
        drops: { "old-receiver": 1 },
        draft_picks: [],
        waiver_budget: [],
        settings: {},
        metadata: {},
      },
      {
        transaction_id: "new-add",
        type: "waiver",
        status: "complete",
        creator: "user-two",
        created: 1_786_484_800_000,
        roster_ids: [2],
        consenter_ids: [],
        adds: { "available-runner": 2 },
        draft_picks: [],
        waiver_budget: [],
        settings: {},
        metadata: {},
      },
      {
        transaction_id: "failed",
        type: "waiver",
        status: "failed",
        creator: "user-two",
        created: 1_786_490_000_000,
        roster_ids: [2],
        consenter_ids: [],
        draft_picks: [],
        waiver_budget: [],
        settings: {},
        metadata: {},
      },
    ],
    winnersBracket: [],
    losersBracket: [],
    tradedPicks: [],
    drafts: [
      {
        draft_id: "other-draft",
        league_id: "connected-league",
        type: "snake",
        status: "pre_draft",
        season: "2026",
        sport: "nfl",
        settings: {},
        metadata: {},
        draft_order: { "user-one": 1, "user-two": 2 },
      },
      {
        draft_id: "current-draft",
        league_id: "connected-league",
        type: "snake",
        status: "pre_draft",
        season: "2026",
        sport: "nfl",
        settings: {},
        metadata: {},
        draft_order: { "user-one": 2, "user-two": 1 },
        slot_to_roster_id: { "1": 2, "2": 1 },
      },
    ],
    players: [
      player("available-runner", "Available Runner", "RB", "BUF"),
      player("old-receiver", "Old Receiver", "WR", "MIA"),
    ],
    projections: [],
  };
}

function player(
  id: string,
  fullName: string,
  position: Player["position"],
  team: string,
): Player {
  const [firstName = "Player", ...lastName] = fullName.split(" ");
  return {
    id,
    sleeperId: id,
    firstName,
    lastName: lastName.join(" "),
    fullName,
    normalizedName: fullName.toLowerCase(),
    position,
    team,
    status: "active",
    fantasyPositions: [position],
  };
}
