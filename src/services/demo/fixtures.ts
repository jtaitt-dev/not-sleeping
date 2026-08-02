import type {
  DraftContext,
  DraftMode,
  DraftPick,
  LeagueFormat,
  Player,
} from "@/types/domain";

import type { ValuationInputs } from "../ranking/valuation";

export type DemoFixture = {
  id: string;
  label: string;
  description: string;
  context: DraftContext;
  format: LeagueFormat;
  players: Array<{ player: Player; inputs: ValuationInputs }>;
  picks: DraftPick[];
  scenario:
    | "normal"
    | "position_run"
    | "sleeper_outage"
    | "openai_invalid_key"
    | "openai_quota"
    | "openai_rate_limit"
    | "offline"
    | "completed";
};

const playerRows: Array<
  [
    id: string,
    fullName: string,
    position: Player["position"],
    team: string,
    age: number,
    searchRank: number,
    nflPick: number,
  ]
> = [
  ["4046", "Malik Nabers", "WR", "NYG", 23.0, 8, 6],
  ["11565", "Brock Bowers", "TE", "LV", 23.6, 12, 13],
  ["9509", "Bijan Robinson", "RB", "ATL", 24.5, 4, 8],
  ["9756", "Jaxon Smith-Njigba", "WR", "SEA", 24.4, 13, 20],
  ["11560", "Caleb Williams", "QB", "CHI", 24.7, 15, 1],
  ["11564", "Rome Odunze", "WR", "CHI", 24.1, 19, 9],
  ["8110", "Trey McBride", "TE", "ARI", 26.7, 20, 55],
  ["7526", "George Pickens", "WR", "DAL", 25.4, 24, 52],
  ["7588", "Kenneth Walker III", "RB", "SEA", 25.7, 28, 41],
  ["6794", "Drake London", "WR", "ATL", 25.0, 22, 8],
  ["6804", "Ja'Marr Chase", "WR", "CIN", 26.4, 1, 5],
  ["9226", "Breece Hall", "RB", "NYJ", 25.2, 18, 36],
  ["11604", "Jayden Daniels", "QB", "WAS", 25.6, 7, 2],
  ["11628", "Brian Thomas Jr.", "WR", "JAX", 23.8, 10, 23],
  ["11631", "Xavier Worthy", "WR", "KC", 23.3, 26, 28],
  ["11620", "Bucky Irving", "RB", "TB", 24.1, 34, 125],
  ["11566", "Marvin Harrison Jr.", "WR", "ARI", 23.9, 16, 4],
  ["11637", "Trey Benson", "RB", "ARI", 24.0, 42, 66],
  ["14701", "Arch Manning", "QB", "FA", 22.1, 3, 1],
  ["14702", "Jeremiah Smith", "WR", "FA", 20.7, 5, 3],
  ["14703", "Ryan Williams", "WR", "FA", 19.8, 9, 8],
  ["14704", "Nicholas Singleton", "RB", "FA", 22.1, 17, 24],
];

export const DEMO_PLAYERS = playerRows.map(
  ([id, fullName, position, team, age, searchRank, nflPick]) =>
    makePlayer(id, fullName, position, team, age, searchRank, nflPick),
);

const defaultInputs = new Map<string, ValuationInputs>(
  DEMO_PLAYERS.map((player, index) => [
    player.id,
    {
      importedRank: index + 4,
      importedTier: index < 5 ? 2 : index < 12 ? 3 : 4,
      adp: index + 16,
      projectedPoints: 312 - index * 7,
      redraftValue: 92 - index * 1.8,
      dynastyValue: 96 - index * 1.55,
      rookieValue: player.yearsExperience === 0 ? 94 - index : undefined,
      historicalProduction: 86 - index,
      recentProduction: 90 - index * 0.8,
      injuryRisk: index % 7 === 0 ? 3 : 1,
    },
  ]),
);

const recentPicks = [
  ["11620", "Grid Iron Giants"],
  ["11631", "Fantasy Phantoms"],
  ["11628", "Touchdown Terrors"],
  ["11604", "4th & Future"],
  ["11637", "The Rebuilders"],
  ["11566", "Dynasty or Bust"],
] as const;

function fixture(
  id: string,
  label: string,
  mode: DraftMode,
  overrides: Partial<DemoFixture> = {},
): DemoFixture {
  const format = formatFor(mode);
  const players = DEMO_PLAYERS.filter((player) =>
    mode === "dynasty_rookie"
      ? player.id.startsWith("147")
      : !player.id.startsWith("147"),
  ).map((player) => ({
    player,
    inputs: {
      ...defaultInputs.get(player.id),
      ...(mode === "dynasty_rookie"
        ? {
            dynastyValue: 92 - Number(player.id.slice(-1)) * 2,
            rookieValue: 96 - Number(player.id.slice(-1)) * 1.5,
            projectedPoints: 220 - Number(player.id.slice(-1)) * 8,
          }
        : {}),
    },
  }));
  const context: DraftContext = {
    supported: true,
    source: "demo",
    username: "demo_manager",
    leagueId: `demo-league-${id}`,
    leagueName: "Sunday Night Sickos",
    draftId: `demo-draft-${id}`,
    draftName: label,
    rosterId: "demo-roster-7",
    mode,
    modeConfidence: 0.98,
    modeEvidence: ["Demo fixture configuration", "League roster settings"],
    currentPick: mode === "dynasty_rookie" ? 15 : 31,
    currentRound: mode === "dynasty_rookie" ? 2 : 3,
    currentDrafter: "Grid Iron Giants",
    nextUserPick: mode === "dynasty_rookie" ? 19 : 35,
    picksUntilUser: 4,
    secondsRemaining: 84,
    status: "drafting",
    lastUpdatedAt: Date.now(),
    connected: true,
  };
  return {
    id,
    label,
    description: `${format.teams}-team ${format.scoring.replace("_", " ")} ${mode.replaceAll("_", " ")}.`,
    context,
    format,
    players,
    picks: buildPicks(),
    scenario: "normal",
    ...overrides,
  };
}

export const DEMO_FIXTURES: DemoFixture[] = [
  fixture("redraft", "Full-PPR Redraft", "redraft"),
  fixture("startup", "Superflex Dynasty Startup", "dynasty_startup"),
  fixture("rookie", "Superflex Rookie Draft", "dynasty_rookie"),
  fixture("keeper", "Keeper Draft", "keeper"),
  fixture("best-ball", "Best Ball Draft", "best_ball"),
  fixture("idp", "IDP League", "redraft", {
    format: {
      ...formatFor("redraft"),
      idp: true,
      starters: {
        ...formatFor("redraft").starters,
        DL: 2,
        LB: 2,
        DB: 2,
      },
    },
  }),
  fixture("completed", "Completed Draft", "redraft", {
    scenario: "completed",
    context: {
      ...fixture("completed-base", "Completed", "redraft").context,
      status: "complete",
      currentPick: 180,
      currentRound: 15,
      picksUntilUser: 0,
      secondsRemaining: undefined,
    },
  }),
  fixture("traded-picks", "Traded Rookie Picks", "dynasty_rookie"),
  fixture("position-run", "Position Run", "dynasty_startup", {
    scenario: "position_run",
  }),
  fixture("identity", "Ambiguous Identity Match", "dynasty_rookie"),
  fixture("sleeper-outage", "Sleeper Outage", "redraft", {
    scenario: "sleeper_outage",
    context: {
      ...fixture("outage-base", "Outage", "redraft").context,
      connected: false,
    },
  }),
  fixture("invalid-key", "OpenAI Invalid Key", "redraft", {
    scenario: "openai_invalid_key",
  }),
  fixture("quota", "OpenAI Quota Error", "redraft", {
    scenario: "openai_quota",
  }),
  fixture("rate-limit", "OpenAI Rate Limit", "redraft", {
    scenario: "openai_rate_limit",
  }),
  fixture("offline", "Offline Mode", "dynasty_startup", {
    scenario: "offline",
    context: {
      ...fixture("offline-base", "Offline", "dynasty_startup").context,
      connected: false,
    },
  }),
];

function makePlayer(
  id: string,
  fullName: string,
  position: Player["position"],
  team: string,
  age: number,
  searchRank: number,
  nflDraftPick: number,
): Player {
  const parts = fullName.split(" ");
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  return {
    id,
    sleeperId: id,
    firstName,
    lastName,
    fullName,
    normalizedName: fullName.toLowerCase().replaceAll(/[^a-z0-9]/g, ""),
    position,
    team,
    age,
    yearsExperience: id.startsWith("147") ? 0 : 2,
    status: "active",
    nflDraftYear: id.startsWith("147") ? 2026 : 2024,
    nflDraftRound: Math.ceil(nflDraftPick / 32),
    nflDraftPick,
    searchRank,
    fantasyPositions: [position],
  };
}

function formatFor(mode: DraftMode): LeagueFormat {
  return {
    teams: 12,
    mode,
    scoring: "ppr",
    superflex: mode === "dynasty_startup" || mode === "dynasty_rookie",
    twoQuarterback: false,
    tightEndPremium: mode === "dynasty_startup",
    pointsPerFirstDown: false,
    bestBall: mode === "best_ball",
    idp: false,
    starters: {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 1,
      FLEX: 2,
      ...(mode === "dynasty_startup" || mode === "dynasty_rookie"
        ? { SUPER_FLEX: 1 }
        : {}),
    },
    bench: mode === "dynasty_startup" ? 14 : 7,
    taxi: mode.startsWith("dynasty") ? 4 : 0,
    injuredReserve: 3,
  };
}

function buildPicks(): DraftPick[] {
  return recentPicks.map(([playerId, pickedBy], index) => {
    const player = DEMO_PLAYERS.find((entry) => entry.id === playerId);
    if (!player) throw new Error("Demo pick references an unknown player.");
    const pickNumber = 30 - index;
    return {
      pickNumber,
      round: 3,
      pickInRound: pickNumber - 24,
      playerId,
      playerName: player.fullName,
      position: player.position,
      team: player.team,
      rosterId: `demo-roster-${index + 1}`,
      pickedBy,
      isKeeper: false,
      isUserPick: index === 4,
      timestamp: Date.now() - index * 32_000,
    };
  });
}
