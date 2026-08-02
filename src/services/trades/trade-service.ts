import type { LeagueContext } from "@/types/league";
import type { SleeperTransaction } from "@/schemas/sleeper";

export type TradeAssetType = "player" | "pick" | "faab" | "manual";

export type TradeAsset = {
  id: string;
  type: TradeAssetType;
  label: string;
  position?: string;
  marketValue: number;
  productionValue: number;
  dynastyValue: number;
  age?: number;
  injuryRisk?: number;
  keeperCost?: number | null;
  rosterSpaceCost?: number;
  liquidity?: number;
};

export type TradeParty = {
  rosterId: number;
  teamName: string;
  sends: TradeAsset[];
  receives: TradeAsset[];
  beforeStarterPoints: number;
  afterStarterPoints: number;
  beforeDepth: number;
  afterDepth: number;
  rosterSpotsAfter: number;
};

export type TradePartyAnalysis = {
  rosterId: number;
  teamName: string;
  sentValue: number;
  receivedValue: number;
  netValue: number;
  weeklyPointsChange: number;
  depthChange: number;
  ageChange: number;
  futurePickChange: number;
  rosterSpaceIssue: boolean;
  contenderChange: number;
  rebuildChange: number;
};

export type TradeAnalysis = {
  parties: TradePartyAnalysis[];
  fairnessGap: number;
  fairness: "balanced" | "negotiable" | "lopsided";
  conditions: string[];
  noWriteBoundary: string;
};

export type TradeFinderRoster = {
  rosterId: number;
  teamName: string;
  assets: TradeAsset[];
};

export type TradeTarget = {
  partnerRosterId: number;
  partnerName: string;
  send: TradeAsset[];
  receive: TradeAsset[];
  fairnessGap: number;
  negotiationRange: { low: number; high: number };
  whyBothMayAccept: string[];
  alternative: string;
  assetsNotToInclude: string[];
};

export type LeagueTradeMarket = {
  completedTrades: number;
  activity: "insufficient_data" | "rare" | "moderate" | "frequent";
  typicalAssetCount: number | null;
  pickTradeRate: number | null;
  faabTradeRate: number | null;
};

export function analyzeTrade(input: {
  context: LeagueContext;
  parties: TradeParty[];
  positionalScarcity?: Record<string, number>;
  deadlineDays?: number | null;
}): TradeAnalysis {
  if (input.parties.length < 2)
    throw new Error("A trade requires at least two parties.");
  const analyses = input.parties.map((party) => {
    const sent = party.sends.reduce(
      (sum, asset) =>
        sum +
        leagueAdjustedAssetValue(
          asset,
          input.context,
          input.positionalScarcity,
        ),
      0,
    );
    const received = party.receives.reduce(
      (sum, asset) =>
        sum +
        leagueAdjustedAssetValue(
          asset,
          input.context,
          input.positionalScarcity,
        ),
      0,
    );
    const sentPlayers = party.sends.filter((asset) => asset.type === "player");
    const receivedPlayers = party.receives.filter(
      (asset) => asset.type === "player",
    );
    const ageChange = averageAge(receivedPlayers) - averageAge(sentPlayers);
    const futurePickChange =
      party.receives
        .filter((asset) => asset.type === "pick")
        .reduce((sum, asset) => sum + asset.dynastyValue, 0) -
      party.sends
        .filter((asset) => asset.type === "pick")
        .reduce((sum, asset) => sum + asset.dynastyValue, 0);
    const weeklyPointsChange =
      party.afterStarterPoints - party.beforeStarterPoints;
    return {
      rosterId: party.rosterId,
      teamName: party.teamName,
      sentValue: round(sent),
      receivedValue: round(received),
      netValue: round(received - sent),
      weeklyPointsChange: round(weeklyPointsChange),
      depthChange: round(party.afterDepth - party.beforeDepth),
      ageChange: round(ageChange),
      futurePickChange: round(futurePickChange),
      rosterSpaceIssue: party.rosterSpotsAfter < 0,
      contenderChange: round(
        weeklyPointsChange * 2.5 + (received - sent) * 0.18,
      ),
      rebuildChange: round(
        futurePickChange * 0.6 - ageChange * 2 + (received - sent) * 0.2,
      ),
    };
  });
  const values = analyses.map((analysis) => analysis.receivedValue);
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  const fairnessGap = maximum === 0 ? 0 : (maximum - minimum) / maximum;
  const fairness =
    fairnessGap <= 0.08
      ? "balanced"
      : fairnessGap <= 0.2
        ? "negotiable"
        : "lopsided";
  const conditions = [
    ...(analyses.some((analysis) => analysis.rosterSpaceIssue)
      ? ["At least one roster must make an additional legal cut."]
      : []),
    ...(input.deadlineDays !== null &&
    input.deadlineDays !== undefined &&
    input.deadlineDays <= 7
      ? [
          "Trade deadline proximity reduces negotiation time and replacement options.",
        ]
      : []),
    ...(fairness === "lopsided"
      ? [
          "Add a liquid pick or replacement-level player to narrow the value gap.",
        ]
      : []),
  ];
  return {
    parties: analyses,
    fairnessGap: round(fairnessGap),
    fairness,
    conditions,
    noWriteBoundary:
      "Analysis only — Not Sleeping never sends or accepts Sleeper trades.",
  };
}

export function findTradeTargets(input: {
  context: LeagueContext;
  user: TradeFinderRoster;
  opponents: TradeFinderRoster[];
  fairnessBand?: number;
}): TradeTarget[] {
  const fairnessBand = clamp(input.fairnessBand ?? 0.28, 0.05, 0.5);
  const userNeeds = positionalNeeds(
    input.context.rosterPositions,
    input.user.assets,
  );
  const userSurplus = positionalSurplus(
    input.context.rosterPositions,
    input.user.assets,
  );
  const protectedIds = new Set(
    input.user.assets
      .toSorted(
        (left, right) =>
          leagueAdjustedAssetValue(right, input.context) -
          leagueAdjustedAssetValue(left, input.context),
      )
      .slice(0, 3)
      .map((asset) => asset.id),
  );
  return input.opponents
    .flatMap((opponent) => {
      const opponentNeeds = positionalNeeds(
        input.context.rosterPositions,
        opponent.assets,
      );
      const opponentSurplus = positionalSurplus(
        input.context.rosterPositions,
        opponent.assets,
      );
      const target = opponent.assets
        .filter(
          (asset) =>
            asset.type !== "player" ||
            ((userNeeds[asset.position?.toUpperCase() ?? ""] ?? 0) > 0 &&
              (opponentSurplus[asset.position?.toUpperCase() ?? ""] ?? 0) > 0),
        )
        .toSorted(
          (left, right) =>
            leagueAdjustedAssetValue(right, input.context) -
            leagueAdjustedAssetValue(left, input.context),
        )[0];
      if (!target) return [];
      const targetValue = leagueAdjustedAssetValue(target, input.context);
      const send = input.user.assets
        .filter(
          (asset) =>
            !protectedIds.has(asset.id) &&
            (asset.type !== "player" ||
              ((userSurplus[asset.position?.toUpperCase() ?? ""] ?? 0) > 0 &&
                (opponentNeeds[asset.position?.toUpperCase() ?? ""] ?? 0) > 0)),
        )
        .map((asset) => ({
          asset,
          value: leagueAdjustedAssetValue(asset, input.context),
        }))
        .toSorted(
          (left, right) =>
            Math.abs(left.value - targetValue) -
              Math.abs(right.value - targetValue) ||
            left.asset.id.localeCompare(right.asset.id),
        )[0];
      if (!send) return [];
      const fairnessGap =
        Math.abs(send.value - targetValue) /
        Math.max(1, send.value, targetValue);
      if (fairnessGap > fairnessBand) return [];
      const sendPosition = send.asset.position?.toUpperCase() ?? "asset";
      const receivePosition = target.position?.toUpperCase() ?? "asset";
      return [
        {
          partnerRosterId: opponent.rosterId,
          partnerName: opponent.teamName,
          send: [send.asset],
          receive: [target],
          fairnessGap: round(fairnessGap),
          negotiationRange: {
            low: round(targetValue * (1 - fairnessBand / 2)),
            high: round(targetValue * (1 + fairnessBand / 2)),
          },
          whyBothMayAccept: [
            `Your ${sendPosition} surplus addresses the partner's modeled need.`,
            `Their ${receivePosition} surplus addresses your modeled need.`,
            `League-adjusted values are within ${Math.round(fairnessGap * 100)}%.`,
          ],
          alternative:
            "If either side declines, substitute a similarly valued future pick or liquid bench asset; re-run before proposing.",
          assetsNotToInclude: input.user.assets
            .filter((asset) => protectedIds.has(asset.id))
            .map((asset) => asset.label),
        },
      ];
    })
    .toSorted(
      (left, right) =>
        left.fairnessGap - right.fairnessGap ||
        left.partnerRosterId - right.partnerRosterId,
    )
    .slice(0, 5);
}

export function calibrateLeagueTradeMarket(
  transactions: SleeperTransaction[],
): LeagueTradeMarket {
  const trades = transactions.filter(
    (transaction) =>
      transaction.type === "trade" && transaction.status === "complete",
  );
  if (trades.length === 0) {
    return {
      completedTrades: 0,
      activity: "insufficient_data",
      typicalAssetCount: null,
      pickTradeRate: null,
      faabTradeRate: null,
    };
  }
  const assetCounts = trades.map(
    (trade) =>
      Object.keys(trade.adds ?? {}).length +
      trade.draft_picks.length +
      trade.waiver_budget.length,
  );
  return {
    completedTrades: trades.length,
    activity:
      trades.length < 3
        ? "insufficient_data"
        : trades.length < 6
          ? "rare"
          : trades.length < 12
            ? "moderate"
            : "frequent",
    typicalAssetCount: round(median(assetCounts) ?? 0),
    pickTradeRate: round(
      trades.filter((trade) => trade.draft_picks.length > 0).length /
        trades.length,
    ),
    faabTradeRate: round(
      trades.filter((trade) => trade.waiver_budget.length > 0).length /
        trades.length,
    ),
  };
}

export function leagueAdjustedAssetValue(
  asset: TradeAsset,
  context: LeagueContext,
  positionalScarcity: Record<string, number> = {},
): number {
  const strategyValue =
    context.strategy === "contender"
      ? asset.productionValue * 0.55 +
        asset.marketValue * 0.3 +
        asset.dynastyValue * 0.15
      : context.strategy === "rebuild" ||
          context.strategy === "productive_struggle"
        ? asset.dynastyValue * 0.55 +
          asset.marketValue * 0.35 +
          asset.productionValue * 0.1
        : asset.marketValue * 0.45 +
          asset.productionValue * 0.3 +
          asset.dynastyValue * 0.25;
  const position = asset.position?.toUpperCase();
  const scarcity = position ? (positionalScarcity[position] ?? 0) : 0;
  const superflex =
    context.rosterPositions.includes("SUPER_FLEX") && position === "QB"
      ? 1.24
      : 1;
  const tePremium =
    position === "TE" &&
    Object.keys(context.scoringSettings).some((key) => key.includes("te"))
      ? 1.1
      : 1;
  const risk = 1 - clamp(asset.injuryRisk ?? 0, 0, 0.75) * 0.22;
  const liquidity = 0.9 + clamp(asset.liquidity ?? 0.5, 0, 1) * 0.2;
  const rosterCost = Math.max(0, asset.rosterSpaceCost ?? 0);
  return Math.max(
    0,
    strategyValue *
      (1 + scarcity * 0.12) *
      superflex *
      tePremium *
      risk *
      liquidity -
      rosterCost,
  );
}

function positionalNeeds(
  rosterPositions: string[],
  assets: TradeAsset[],
): Record<string, number> {
  const required = requiredPositions(rosterPositions);
  const actual = playerPositionCounts(assets);
  return Object.fromEntries(
    Object.entries(required).map(([position, count]) => [
      position,
      Math.max(0, count - (actual[position] ?? 0)),
    ]),
  );
}

function positionalSurplus(
  rosterPositions: string[],
  assets: TradeAsset[],
): Record<string, number> {
  const required = requiredPositions(rosterPositions);
  const actual = playerPositionCounts(assets);
  return Object.fromEntries(
    Object.entries(actual).map(([position, count]) => [
      position,
      Math.max(0, count - (required[position] ?? 0) - 1),
    ]),
  );
}

function requiredPositions(rosterPositions: string[]): Record<string, number> {
  return rosterPositions.reduce<Record<string, number>>((counts, slot) => {
    const normalized = slot.toUpperCase();
    if (
      [
        "BN",
        "IR",
        "TAXI",
        "FLEX",
        "WRRB_FLEX",
        "REC_FLEX",
        "SUPER_FLEX",
        "IDP_FLEX",
      ].includes(normalized)
    ) {
      return counts;
    }
    counts[normalized] = (counts[normalized] ?? 0) + 1;
    return counts;
  }, {});
}

function playerPositionCounts(assets: TradeAsset[]): Record<string, number> {
  return assets.reduce<Record<string, number>>((counts, asset) => {
    if (asset.type !== "player" || !asset.position) return counts;
    const position = asset.position.toUpperCase();
    counts[position] = (counts[position] ?? 0) + 1;
    return counts;
  }, {});
}

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function averageAge(assets: TradeAsset[]): number {
  const ages = assets.flatMap((asset) =>
    typeof asset.age === "number" && Number.isFinite(asset.age)
      ? [asset.age]
      : [],
  );
  return ages.length === 0
    ? 0
    : ages.reduce((sum, age) => sum + age, 0) / ages.length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
