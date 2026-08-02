import type { SleeperRoster, SleeperTransaction } from "@/schemas/sleeper";
import type { LeagueContext } from "@/types/league";

export type WaiverPlayer = {
  playerId: string;
  name: string;
  positions: string[];
  team?: string;
  shortTermValue: number;
  restOfSeasonValue: number;
  dynastyValue: number;
  contenderValue: number;
  rebuildValue: number;
  breakoutProbability: number;
  stashValue: number;
  risk: number;
  taxiEligible?: boolean;
  irEligible?: boolean;
};

export type DropCandidate = {
  neverDrop?: boolean;
  preferDrop?: boolean;
  temporaryHold?: boolean;
  handcuffValue?: number;
  irreplaceableStarter?: boolean;
} & WaiverPlayer;

export type FaabRecommendation = {
  minimumBid: number;
  conservativeBid: number;
  expectedWinningBid: number;
  aggressiveBid: number;
  maximumRationalBid: number;
  budgetAfterExpectedBid: number;
  percentages: {
    conservative: number;
    expected: number;
    aggressive: number;
    maximum: number;
  };
  opportunityCost: string;
};

export type WaiverRecommendation = {
  playerId: string;
  addPriority: number;
  rosterFit: number;
  dropCandidateId: string | null;
  action: "claim" | "save_priority" | "free_agent_wait" | "monitor";
  faab: FaabRecommendation | null;
  rationale: string[];
};

export function availablePlayerIds(input: {
  allPlayerIds: string[];
  rosters: SleeperRoster[];
  pendingTransactions?: SleeperTransaction[];
}): string[] {
  const rostered = new Set<string>();
  for (const roster of input.rosters) {
    for (const playerId of [
      ...(roster.players ?? []),
      ...(roster.starters ?? []),
      ...(roster.reserve ?? []),
      ...(roster.taxi ?? []),
    ]) {
      rostered.add(playerId);
    }
  }
  for (const transaction of input.pendingTransactions ?? []) {
    if (!isPending(transaction)) continue;
    for (const playerId of Object.keys(transaction.adds ?? {}))
      rostered.add(playerId);
    for (const playerId of Object.keys(transaction.drops ?? {}))
      rostered.delete(playerId);
  }
  return [...new Set(input.allPlayerIds)].filter(
    (playerId) => !rostered.has(playerId),
  );
}

export function recommendWaiver(input: {
  context: LeagueContext;
  player: WaiverPlayer;
  roster: DropCandidate[];
  budget: number;
  startingBudget: number;
  otherBudgets?: number[];
  historicalWinningBids?: number[];
  waiverPriority?: number | null;
  leagueSize: number;
  positionNeed: number;
  positionScarcity: number;
  urgency: number;
  zeroDollarAllowed?: boolean;
}): WaiverRecommendation {
  const rosterFit = clamp(
    input.positionNeed * 0.45 +
      input.positionScarcity * 0.2 +
      (input.player.restOfSeasonValue / 100) * 0.25 +
      (input.player.shortTermValue / 100) * 0.1,
    0,
    1,
  );
  const addPriority = round(
    clamp(
      input.player.restOfSeasonValue * 0.35 +
        input.player.shortTermValue * 0.2 +
        input.player.dynastyValue *
          (input.context.leagueType === "dynasty" ? 0.25 : 0.05) +
        rosterFit * 20 +
        input.player.breakoutProbability * 10 -
        input.player.risk * 8,
      0,
      100,
    ),
  );
  const dropCandidate = chooseDropCandidate(input.roster, input.context);
  const rationale = [
    `${Math.round(rosterFit * 100)}% roster fit`,
    `${Math.round(input.player.breakoutProbability * 100)}% breakout probability`,
    input.context.leagueType === "dynasty"
      ? `${Math.round(input.player.dynastyValue)} dynasty value`
      : `${Math.round(input.player.restOfSeasonValue)} rest-of-season value`,
  ];
  const faab = input.context.waiverType.startsWith("faab")
    ? recommendFaab({
        playerValue: addPriority,
        rosterFit,
        budget: input.budget,
        startingBudget: input.startingBudget,
        otherBudgets: input.otherBudgets,
        historicalWinningBids: input.historicalWinningBids,
        leagueSize: input.leagueSize,
        scarcity: input.positionScarcity,
        urgency: input.urgency,
        zeroDollarAllowed: input.zeroDollarAllowed,
      })
    : null;
  return {
    playerId: input.player.playerId,
    addPriority,
    rosterFit: round(rosterFit),
    dropCandidateId: dropCandidate?.playerId ?? null,
    action: waiverAction(
      input.context.waiverType,
      addPriority,
      input.waiverPriority,
    ),
    faab,
    rationale,
  };
}

export function recommendFaab(input: {
  playerValue: number;
  rosterFit: number;
  budget: number;
  startingBudget: number;
  otherBudgets?: number[];
  historicalWinningBids?: number[];
  leagueSize: number;
  scarcity: number;
  urgency: number;
  zeroDollarAllowed?: boolean;
}): FaabRecommendation {
  const budget = Math.max(0, Math.floor(input.budget));
  const startingBudget = Math.max(1, Math.floor(input.startingBudget));
  const baseRate = clamp(input.playerValue / 100, 0, 1);
  const marketBid = median(input.historicalWinningBids ?? []);
  const competition = clamp((input.leagueSize - 8) / 16, 0, 1);
  const rawPercentage = clamp(
    baseRate * 0.16 +
      input.rosterFit * 0.08 +
      input.scarcity * 0.07 +
      input.urgency * 0.09 +
      competition * 0.04,
    input.zeroDollarAllowed ? 0 : 0.01,
    0.72,
  );
  const modeledBid = Math.round(rawPercentage * startingBudget);
  const expectedWinningBid = clampInt(
    marketBid === null
      ? modeledBid
      : Math.round(modeledBid * 0.55 + marketBid * 0.45),
    input.zeroDollarAllowed ? 0 : 1,
    budget,
  );
  const maximumOtherBudget = Math.max(0, ...(input.otherBudgets ?? [budget]));
  const maximumLegalCompetitionBid = Math.max(
    expectedWinningBid,
    Math.min(budget, maximumOtherBudget + 1),
  );
  const maximumRationalBid = clampInt(
    Math.round(
      expectedWinningBid * 1.75 + input.urgency * startingBudget * 0.08,
    ),
    expectedWinningBid,
    maximumLegalCompetitionBid,
  );
  const conservativeBid = clampInt(
    Math.round(expectedWinningBid * 0.72),
    input.zeroDollarAllowed ? 0 : 1,
    budget,
  );
  const aggressiveBid = clampInt(
    Math.round(expectedWinningBid * 1.28),
    expectedWinningBid,
    maximumRationalBid,
  );
  const minimumBid = input.zeroDollarAllowed ? 0 : 1;
  return {
    minimumBid,
    conservativeBid,
    expectedWinningBid,
    aggressiveBid,
    maximumRationalBid,
    budgetAfterExpectedBid: budget - expectedWinningBid,
    percentages: {
      conservative: percent(conservativeBid, startingBudget),
      expected: percent(expectedWinningBid, startingBudget),
      aggressive: percent(aggressiveBid, startingBudget),
      maximum: percent(maximumRationalBid, startingBudget),
    },
    opportunityCost:
      expectedWinningBid > budget * 0.35
        ? "This bid uses more than one third of the remaining budget; preserve contingency claims unless the roster need is urgent."
        : "The modeled bid preserves room for later claims and contingency ordering.",
  };
}

export function chooseDropCandidate(
  roster: DropCandidate[],
  context: Pick<LeagueContext, "leagueType" | "strategy">,
): DropCandidate | null {
  return (
    roster
      .filter((player) => !player.neverDrop && !player.irreplaceableStarter)
      .map((player) => ({
        player,
        score:
          player.restOfSeasonValue * 0.35 +
          player.shortTermValue * 0.2 +
          player.stashValue * 0.12 +
          (player.handcuffValue ?? 0) * 0.08 +
          (context.leagueType === "dynasty" ? player.dynastyValue * 0.25 : 0) +
          (player.temporaryHold ? 18 : 0) -
          (player.preferDrop ? 20 : 0),
      }))
      .toSorted(
        (left, right) =>
          left.score - right.score ||
          left.player.playerId.localeCompare(right.player.playerId),
      )[0]?.player ?? null
  );
}

function waiverAction(
  waiverType: LeagueContext["waiverType"],
  priority: number,
  waiverPriority?: number | null,
): WaiverRecommendation["action"] {
  if (waiverType === "disabled") return "monitor";
  if (waiverType === "free_agents")
    return priority >= 55 ? "claim" : "free_agent_wait";
  if (waiverType === "rolling" && (waiverPriority ?? 1) <= 3 && priority < 70) {
    return "save_priority";
  }
  return priority >= 52 ? "claim" : "monitor";
}

function isPending(transaction: SleeperTransaction): boolean {
  return ["pending", "processing", "complete_pending"].includes(
    transaction.status,
  );
}

function median(values: number[]): number | null {
  const sorted = values
    .filter(Number.isFinite)
    .toSorted((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : (sorted[middle] ?? null);
}

function percent(value: number, total: number): number {
  return Math.round((value / total) * 10_000) / 100;
}

function clampInt(value: number, minimum: number, maximum: number): number {
  return Math.round(clamp(value, minimum, maximum));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
