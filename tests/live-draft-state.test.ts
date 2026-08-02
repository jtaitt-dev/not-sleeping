import {
  sleeperDraftPickSchema,
  sleeperDraftSchema,
  sleeperLeagueSchema,
} from "@/schemas/sleeper";
import { buildLiveDraftState } from "@/services/context/live-draft-state";
import { DEFAULT_SETTINGS } from "@/services/storage/settings";
import type { Player } from "@/types/domain";
import { describe, expect, it } from "vitest";

const players: Player[] = [
  player("p1", "Alpha Runner", "RB", 1),
  player("p2", "Bravo Receiver", "WR", 2),
  player("p3", "Charlie Quarterback", "QB", 3),
];

describe("buildLiveDraftState", () => {
  it("normalizes an unstarted league-less Sleeper mock draft", () => {
    const draft = sleeperDraftSchema.parse({
      created: 1_784_849_939_866,
      creators: ["user_c"],
      draft_id: "1386164751989485568",
      league_id: null,
      type: "snake",
      status: "pre_draft",
      season: "2026",
      sport: "nfl",
      start_time: null,
      last_picked: null,
      last_message_time: 1_784_849_939_866,
      settings: {
        autostart: 0,
        cpu_autopick: 1,
        pick_timer: 120,
        teams: 10,
        rounds: 15,
        slots_qb: 1,
        slots_rb: 2,
        slots_wr: 2,
        slots_te: 1,
        slots_flex: 2,
        slots_k: 1,
      },
      metadata: { description: "", name: "", scoring_type: "std" },
      draft_order: null,
      slot_to_roster_id: {
        "1": 1,
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "10": 10,
      },
    });

    const state = buildLiveDraftState({
      draft,
      picks: [],
      players,
      settings: {
        ...DEFAULT_SETTINGS,
        sleeperUsername: "test_manager",
        sleeperUserId: "user_c",
      },
      routeUrl: "https://sleeper.com/draft/nfl/mock-draft-1234",
      now: 1_700_000_000_000,
    });

    expect(state.context).toMatchObject({
      source: "sleeper",
      leagueName: "Sleeper mock draft",
      draftId: "1386164751989485568",
      status: "pre_draft",
      currentPick: 1,
      currentRound: 1,
      secondsRemaining: 120,
      currentDrafter: "Waiting to start",
      connected: true,
    });
    expect(state.format).toMatchObject({
      teams: 10,
      draftRounds: 15,
      mode: "redraft",
      superflex: false,
      bench: 0,
    });
    expect(state.players).toHaveLength(3);
    expect(state.fetchedAt).toBe(1_700_000_000_000);
  });

  it("uses a mock draft's source league and preserves IDP roster slots", () => {
    const draft = sleeperDraftSchema.parse({
      draft_id: "idp-best-ball-mock",
      league_id: null,
      type: "snake",
      status: "pre_draft",
      season: "2026",
      settings: {
        teams: 12,
        rounds: 27,
        slots_qb: 1,
        slots_dl: 2,
        slots_lb: 3,
        slots_db: 2,
        slots_idp_flex: 1,
      },
      metadata: {
        league_id: "source-league",
        name: "IDP Best Ball Mock",
      },
      draft_order: { mock_user: 1 },
    });
    const league = sleeperLeagueSchema.parse({
      league_id: "source-league",
      name: "IDP Best Ball",
      season: "2026",
      total_rosters: 12,
      settings: { best_ball: 1, num_teams: 12 },
      scoring_settings: { rec: 1, bonus_rec_te: 0.5 },
      roster_positions: [
        "QB",
        "DL",
        "DL",
        "LB",
        "LB",
        "LB",
        "DB",
        "DB",
        "IDP_FLEX",
        "BN",
      ],
    });

    const state = buildLiveDraftState({
      draft,
      league,
      picks: [],
      players,
      settings: DEFAULT_SETTINGS,
    });

    expect(state.context).toMatchObject({
      leagueId: "source-league",
      userId: "mock_user",
      nextUserPick: 1,
      picksUntilUser: 0,
    });
    expect(state.format).toMatchObject({
      mode: "best_ball",
      bestBall: true,
      idp: true,
      starters: {
        DL: 2,
        LB: 3,
        DB: 2,
        IDP_FLEX: 1,
      },
    });
  });

  it("maps Sleeper projection ADP and points to live player values", () => {
    const draft = sleeperDraftSchema.parse({
      draft_id: "projection-draft",
      league_id: null,
      type: "snake",
      status: "drafting",
      season: "2026",
      settings: { teams: 10, rounds: 15 },
      metadata: { scoring_type: "std" },
      draft_order: { user_c: 1 },
    });

    const state = buildLiveDraftState({
      draft,
      picks: [],
      players,
      projections: [
        {
          player_id: "p3",
          stats: {
            adp_std: 40.6,
            adp_ppr: 51.2,
            pts_std: 320,
            pts_ppr: 321,
          },
        },
      ],
      settings: DEFAULT_SETTINGS,
    });

    expect(state.playerValues?.p3).toEqual({
      adp: 40.6,
      projectedPoints: 320,
    });
  });

  it("maps picks, removes drafted players, and calculates the snake turn", () => {
    const draft = sleeperDraftSchema.parse({
      draft_id: "mock-draft-5678",
      league_id: null,
      type: "snake",
      status: "drafting",
      season: "2026",
      settings: { teams: 10, rounds: 15 },
      metadata: {},
      draft_order: { user_c: 3 },
    });
    const picks = [
      sleeperDraftPickSchema.parse({
        player_id: "p1",
        picked_by: "other",
        roster_id: 1,
        round: 1,
        draft_slot: 1,
        pick_no: 1,
        metadata: {
          first_name: "Alpha",
          last_name: "Runner",
          position: "RB",
          team: "ATL",
        },
      }),
      ...Array.from({ length: 9 }, (_, index) =>
        sleeperDraftPickSchema.parse({
          player_id: `drafted-${index}`,
          picked_by: `other-${index}`,
          roster_id: index + 2,
          round: 1,
          draft_slot: index + 2,
          pick_no: index + 2,
          metadata: {
            first_name: "Drafted",
            last_name: String(index),
            position: "WR",
          },
        }),
      ),
    ];

    const state = buildLiveDraftState({
      draft,
      picks,
      players,
      settings: {
        ...DEFAULT_SETTINGS,
        sleeperUserId: "user_c",
      },
      now: 100,
    });

    expect(state.context.currentPick).toBe(11);
    expect(state.context.nextUserPick).toBe(18);
    expect(state.context.picksUntilUser).toBe(7);
    expect(state.picks[0]).toMatchObject({
      playerName: "Alpha Runner",
      position: "RB",
      pickedBy: "Draft slot 1",
    });
    expect(state.players.map((entry) => entry.id)).toEqual(["p2", "p3"]);
  });
});

function player(
  id: string,
  fullName: string,
  position: Player["position"],
  searchRank: number,
): Player {
  const [firstName = "", lastName = ""] = fullName.split(" ");
  return {
    id,
    sleeperId: id,
    firstName,
    lastName,
    fullName,
    normalizedName: fullName.toLowerCase(),
    position,
    team: "TST",
    status: "active",
    searchRank,
    fantasyPositions: [position],
  };
}
