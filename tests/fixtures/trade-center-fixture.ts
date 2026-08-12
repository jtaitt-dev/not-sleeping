import type { LeagueSnapshot } from "@/stores/league-store";
import type { Player } from "@/types/domain";
import type { LeagueContext } from "@/types/league";

export function tradeContext(): LeagueContext {
  return {
    leagueId: "trade-league",
    leagueName: "Trade Test League",
    season: "2026",
    week: 1,
    userId: "user-one",
    rosterId: 1,
    leagueType: "dynasty",
    lineupType: "classic",
    draftStyle: "snake",
    waiverType: "faab",
    weeklyElimination: false,
    eliminationTiebreaker: null,
    rosterPositions: ["QB", "RB", "FLEX", "BN"],
    scoringSettings: {},
    settings: { pick_trading: 1, reserve_slots: 0, taxi_slots: 0 },
    strategy: "balanced",
    selectedMatchupId: null,
    dataFreshness: {},
  };
}

export function tradeSnapshot(): LeagueSnapshot {
  const players = [
    player("user-qb", "User Quarterback", "QB", 170),
    player("user-rb", "User Running Back", "RB", 136),
    player("user-wr", "User Receiver", "WR", 204),
    player("partner-qb", "Partner Quarterback", "QB", 153),
    player("partner-rb", "Partner Running Back", "RB", 119),
    player("partner-te", "Partner Tight End", "TE", 102),
  ];
  return {
    userId: "user-one",
    leagueId: "trade-league",
    week: 1,
    fetchedAt: 1_786_484_800_000,
    league: {
      league_id: "trade-league",
      name: "Trade Test League",
      season: "2026",
      sport: "nfl",
      total_rosters: 2,
      draft_id: "rookie-draft",
      settings: { pick_trading: 1 },
      scoring_settings: {},
      roster_positions: ["QB", "RB", "FLEX", "BN"],
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
        username: "partner",
        display_name: "Partner Owner",
        avatar: null,
        metadata: { team_name: "Trade Partner" },
      },
    ],
    rosters: [
      {
        roster_id: 1,
        owner_id: "user-one",
        league_id: "trade-league",
        players: ["user-qb", "user-rb", "user-wr"],
        starters: ["user-qb", "user-rb", "user-wr"],
        reserve: [],
        taxi: [],
        settings: {},
      },
      {
        roster_id: 2,
        owner_id: "user-two",
        league_id: "trade-league",
        players: ["partner-qb", "partner-rb", "partner-te"],
        starters: ["partner-qb", "partner-rb", "partner-te"],
        reserve: [],
        taxi: [],
        settings: {},
      },
    ],
    matchups: [],
    transactions: [],
    winnersBracket: [],
    losersBracket: [],
    tradedPicks: [
      {
        season: "2026",
        round: 1,
        roster_id: 2,
        previous_owner_id: 2,
        owner_id: 1,
      },
    ],
    drafts: [
      {
        draft_id: "rookie-draft",
        league_id: "trade-league",
        type: "snake",
        status: "pre_draft",
        season: "2026",
        sport: "nfl",
        settings: { teams: 2, rounds: 3 },
        metadata: {},
        slot_to_roster_id: { "1": 1, "2": 2 },
      },
    ],
    players,
    projections: players.map((entry) => ({
      player_id: entry.id,
      stats: { pts_ppr: projection(entry.id) },
    })),
  };
}

export function tradePlayer(
  id: string,
  fullName: string,
  position: Player["position"],
  searchRank: number,
): Player {
  return player(id, fullName, position, searchRank);
}

function projection(id: string): number {
  return (
    {
      "user-qb": 170,
      "user-rb": 136,
      "user-wr": 204,
      "partner-qb": 153,
      "partner-rb": 119,
      "partner-te": 102,
    }[id] ?? 85
  );
}

function player(
  id: string,
  fullName: string,
  position: Player["position"],
  searchRank: number,
): Player {
  const [firstName = "Player", ...lastParts] = fullName.split(" ");
  return {
    id,
    sleeperId: id,
    firstName,
    lastName: lastParts.join(" "),
    fullName,
    normalizedName: fullName.toLowerCase(),
    position,
    team: "BUF",
    age: 25,
    searchRank,
    status: "active",
    fantasyPositions: [position],
  };
}
