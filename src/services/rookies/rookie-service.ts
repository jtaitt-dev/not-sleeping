import type { Player } from "@/types/domain";
import type { LeagueContext } from "@/types/league";

export type RookieProfile = {
  playerId: string;
  identity: {
    sleeperId: string;
    team: string | null;
    position: string;
    age: number | null;
    college: string | null;
    draftYear: number | null;
    nflRound: number | null;
    nflOverallPick: number | null;
  };
  immediateProjection: number;
  longTermProjection: number;
  floor: number;
  ceiling: number;
  bustRisk: number;
  contenderFit: number;
  rebuilderFit: number;
  taxiFit: number;
  opportunity: string;
  missingFields: string[];
  evidence: string[];
};

export type RookiePickScenario = {
  id:
    | "player_now"
    | "trade_down"
    | "trade_up"
    | "future_pick"
    | "later_picks"
    | "veteran_return";
  label: string;
  expectedValue: number;
  floor: number;
  ceiling: number;
  uncertainty: number;
  strategyFit: string;
};

export function buildRookieProfile(
  player: Player,
  context: Pick<
    LeagueContext,
    | "strategy"
    | "lineupType"
    | "rosterPositions"
    | "scoringSettings"
    | "settings"
  >,
): RookieProfile {
  const capital = draftCapitalScore(player);
  const rankSignal = Math.max(
    8,
    100 - Math.log2(Math.max(2, player.searchRank ?? 700)) * 9,
  );
  const superflex = context.rosterPositions.includes("SUPER_FLEX");
  const tePremium = Object.entries(context.scoringSettings).some(
    ([key, value]) => key.includes("te") && value > 0,
  );
  const scarcity =
    player.position === "QB" && superflex
      ? 13
      : player.position === "TE" && tePremium
        ? 8
        : isIdp(player.position) && context.rosterPositions.includes("IDP_FLEX")
          ? 5
          : 0;
  const immediate = clamp(capital * 0.46 + rankSignal * 0.42 + scarcity, 5, 98);
  const ageBonus =
    player.age === undefined ? 0 : clamp((23 - player.age) * 2, -6, 8);
  const longTerm = clamp(immediate * 0.88 + ageBonus + 9, 5, 99);
  const uncertainty = player.nflDraftRound ? 13 : 23;
  const taxiSlots = numeric(context.settings["taxi_slots"]);
  const missingFields = [
    ["age", player.age],
    ["college", player.college],
    ["NFL draft year", player.nflDraftYear],
    ["NFL draft round", player.nflDraftRound],
    ["NFL overall pick", player.nflDraftPick],
    ["licensed athletic data", null],
    ["licensed college production", null],
    ["early-declare status", null],
  ].flatMap(([label, value]) =>
    value === undefined || value === null ? [String(label)] : [],
  );

  return {
    playerId: player.id,
    identity: {
      sleeperId: player.sleeperId ?? player.id,
      team: player.team ?? null,
      position: player.position,
      age: player.age ?? null,
      college: player.college ?? null,
      draftYear: player.nflDraftYear ?? null,
      nflRound: player.nflDraftRound ?? null,
      nflOverallPick: player.nflDraftPick ?? null,
    },
    immediateProjection: round(immediate),
    longTermProjection: round(longTerm),
    floor: round(clamp(immediate - uncertainty, 0, 100)),
    ceiling: round(clamp(longTerm + uncertainty * 0.8, 0, 100)),
    bustRisk: round(clamp(100 - capital * 0.55 - rankSignal * 0.25, 5, 92)),
    contenderFit: round(
      clamp(immediate + (context.strategy === "contender" ? 6 : 0), 0, 100),
    ),
    rebuilderFit: round(
      clamp(longTerm + (context.strategy === "rebuild" ? 6 : 0), 0, 100),
    ),
    taxiFit: round(
      clamp(longTerm - immediate + (taxiSlots > 0 ? 58 : 22), 0, 100),
    ),
    opportunity: player.team
      ? `NFL team ${player.team}; depth-chart competition and scheme require current sourced research.`
      : "NFL team unavailable; opportunity is not inferred.",
    missingFields,
    evidence: [
      "Sleeper identity and eligibility",
      player.nflDraftRound
        ? `NFL draft capital: round ${player.nflDraftRound}${player.nflDraftPick ? `, pick ${player.nflDraftPick}` : ""}`
        : "NFL draft capital unavailable",
      `${context.strategy.replaceAll("_", " ")} roster strategy`,
      context.lineupType === "best_ball"
        ? "Best Ball ceiling and depth adjustment"
        : "Classic lineup replacement adjustment",
    ],
  };
}

export function compareRookiePickScenarios(input: {
  pickNumber: number;
  profile: RookieProfile;
  strategy: LeagueContext["strategy"];
  futurePickCount: number;
  taxiOpenSlots: number;
  rosterCutPressure: number;
}): RookiePickScenario[] {
  const pickDecay = Math.max(0.55, 1 - (input.pickNumber - 1) * 0.035);
  const current =
    (input.strategy === "contender"
      ? input.profile.contenderFit
      : input.profile.rebuilderFit) * pickDecay;
  const taxiAdjustment = input.taxiOpenSlots > 0 ? 3 : -4;
  const cutAdjustment = -Math.min(12, input.rosterCutPressure * 2);
  const futureLiquidity = Math.min(8, input.futurePickCount * 1.5);
  return [
    scenario(
      "player_now",
      "Draft player now",
      current + taxiAdjustment,
      16,
      input.strategy,
    ),
    scenario(
      "trade_down",
      "Trade down",
      current * 0.92 + 9 + futureLiquidity,
      18,
      input.strategy,
    ),
    scenario("trade_up", "Trade up", current * 1.07 - 10, 12, input.strategy),
    scenario(
      "future_pick",
      "Take a future pick",
      current * 0.88 + futureLiquidity,
      25,
      "rebuild",
    ),
    scenario(
      "later_picks",
      "Multiple later picks",
      current * 0.82 + 12 + cutAdjustment,
      22,
      input.strategy,
    ),
    scenario(
      "veteran_return",
      "Take a veteran return",
      current * 0.9 + (input.strategy === "contender" ? 11 : -3),
      14,
      "contender",
    ),
  ].toSorted((left, right) => right.expectedValue - left.expectedValue);
}

function scenario(
  id: RookiePickScenario["id"],
  label: string,
  value: number,
  uncertainty: number,
  strategyFit: string,
): RookiePickScenario {
  const expectedValue = round(clamp(value, 0, 100));
  return {
    id,
    label,
    expectedValue,
    floor: round(clamp(expectedValue - uncertainty, 0, 100)),
    ceiling: round(clamp(expectedValue + uncertainty, 0, 100)),
    uncertainty,
    strategyFit,
  };
}

function draftCapitalScore(player: Player): number {
  if (player.nflDraftPick)
    return clamp(
      104 - Math.log2(Math.max(2, player.nflDraftPick)) * 12,
      12,
      99,
    );
  if (player.nflDraftRound)
    return clamp(104 - player.nflDraftRound * 12, 12, 94);
  return 38;
}

function isIdp(position: string): boolean {
  return [
    "DL",
    "DE",
    "DT",
    "EDGE",
    "LB",
    "ILB",
    "OLB",
    "DB",
    "CB",
    "S",
    "FS",
    "SS",
  ].includes(position);
}

function numeric(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
