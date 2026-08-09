export type PropMarket =
  | "passing_yards"
  | "passing_touchdowns"
  | "rushing_yards"
  | "rushing_attempts"
  | "receiving_yards"
  | "receptions"
  | "anytime_touchdown"
  | "kicking_points"
  | "idp_tackles";

export type OddsSourceKind = "manual" | "user_import" | "licensed_provider";
export type LegAvailability =
  "active" | "questionable" | "out" | "inactive" | "unknown";

export type ManualOddsLeg = {
  id: string;
  playerId?: string;
  label: string;
  market: PropMarket | "";
  line: number | null;
  americanOdds: number | null;
  oppositeAmericanOdds: number | null;
  estimatedProbability: number | null;
  uncertainty: number;
  sourceType: OddsSourceKind;
  sourceName: string;
  bookOrConsensus: string;
  recordedAt: string;
  availability: LegAvailability;
};

export type ParlayScenario = {
  valid: boolean;
  legCount: number;
  decimalMultiplier: number;
  marketImpliedProbability: number;
  independentEstimatedProbability: number;
  correlationAdjustedProbability: number;
  expectedReturnIndex: number;
  warnings: string[];
};

export type ParlayCandidate = ParlayScenario & {
  profile: "conservative" | "balanced" | "higher_variance";
  legs: ManualOddsLeg[];
  estimatedEdgeLow: number;
  estimatedEdgeHigh: number;
  uncertainty: number;
  correlationModel: "user_penalty";
};

export type ParlayLabResult = {
  outcome: "watchlist" | "candidates" | "no_responsible_parlay";
  message: string;
  candidates: ParlayCandidate[];
  watchlist: Array<{ id: string; label: string; reason: string }>;
  rejectedLegs: Array<{ id: string; label: string; reason: string }>;
  warnings: string[];
};

export type ParlayBuildOptions = {
  now?: number;
  freshnessLimitMs?: number;
  correlationPenalty?: number;
  allowedPlayerIds?: string[];
};

export const DEFAULT_ODDS_FRESHNESS_LIMIT_MS = 30 * 60 * 1_000;

export function buildResponsibleParlayCandidates(
  legs: ManualOddsLeg[],
  options: ParlayBuildOptions = {},
): ParlayLabResult {
  const now = options.now ?? Date.now();
  const freshnessLimitMs =
    options.freshnessLimitMs ?? DEFAULT_ODDS_FRESHNESS_LIMIT_MS;
  const allowed = options.allowedPlayerIds
    ? new Set(options.allowedPlayerIds)
    : null;
  const current: ManualOddsLeg[] = [];
  const watchlist: ParlayLabResult["watchlist"] = [];
  const rejectedLegs: ParlayLabResult["rejectedLegs"] = [];

  for (const leg of legs) {
    const reason = legEligibilityReason(leg, now, freshnessLimitMs, allowed);
    if (!reason) {
      current.push(leg);
      continue;
    }
    if (reason.kind === "watchlist") {
      watchlist.push({
        id: leg.id,
        label: safeLabel(leg),
        reason: reason.text,
      });
    } else {
      rejectedLegs.push({
        id: leg.id,
        label: safeLabel(leg),
        reason: reason.text,
      });
    }
  }

  if (current.length < 2) {
    const missingOrStale = watchlist.length > 0 || legs.length === 0;
    return {
      outcome: missingOrStale ? "watchlist" : "no_responsible_parlay",
      message: missingOrStale
        ? "Prop Research Watchlist"
        : "No responsible parlay found",
      candidates: [],
      watchlist,
      rejectedLegs,
      warnings: baseWarnings(),
    };
  }

  const ranked = current
    .map((leg) => ({ leg, edge: legEdge(leg) }))
    .sort((left, right) => right.edge.low - left.edge.low);
  const profiles: Array<{
    profile: ParlayCandidate["profile"];
    maximumLegs: number;
    minimumLowEdge: number;
  }> = [
    { profile: "conservative", maximumLegs: 2, minimumLowEdge: 0.01 },
    { profile: "balanced", maximumLegs: 3, minimumLowEdge: 0 },
    { profile: "higher_variance", maximumLegs: 4, minimumLowEdge: -0.01 },
  ];
  const candidates = profiles.flatMap((definition) => {
    const selected = ranked
      .filter((entry) => entry.edge.low >= definition.minimumLowEdge)
      .slice(0, definition.maximumLegs)
      .map((entry) => entry.leg);
    if (selected.length < 2) return [];
    const candidate = makeCandidate(
      definition.profile,
      selected,
      options.correlationPenalty ?? 0.08,
    );
    return candidate.expectedReturnIndex > 1 ? [candidate] : [];
  });

  if (candidates.length === 0) {
    return {
      outcome: "no_responsible_parlay",
      message: "No responsible parlay found",
      candidates: [],
      watchlist,
      rejectedLegs: [
        ...rejectedLegs,
        ...current.map((leg) => ({
          id: leg.id,
          label: safeLabel(leg),
          reason:
            "The supplied probability and uncertainty do not show positive expected value after correlation adjustment.",
        })),
      ],
      warnings: baseWarnings(),
    };
  }

  return {
    outcome: "candidates",
    message: "Research-only candidates",
    candidates,
    watchlist,
    rejectedLegs,
    warnings: baseWarnings(),
  };
}

export function analyzeManualParlayScenario(
  legs: ManualOddsLeg[],
  correlationPenalty: number,
): ParlayScenario {
  const validLegs = legs.filter(isNumericallyValidLeg);
  const boundedPenalty = Math.max(0, Math.min(0.5, correlationPenalty));
  const decimalMultiplier = validLegs.reduce(
    (product, leg) => product * americanToDecimal(leg.americanOdds ?? 0),
    1,
  );
  const marketProbability = validLegs.reduce(
    (product, leg) => product * fairMarketProbability(leg),
    1,
  );
  const independentProbability = validLegs.reduce(
    (product, leg) => product * (leg.estimatedProbability ?? 0),
    1,
  );
  const adjustedProbability =
    independentProbability *
    (1 - boundedPenalty * Math.max(0, validLegs.length - 1));
  const boundedAdjusted = Math.max(0, Math.min(1, adjustedProbability));
  return {
    valid: validLegs.length >= 2 && validLegs.length === legs.length,
    legCount: validLegs.length,
    decimalMultiplier: round(decimalMultiplier),
    marketImpliedProbability: round(marketProbability),
    independentEstimatedProbability: round(independentProbability),
    correlationAdjustedProbability: round(boundedAdjusted),
    expectedReturnIndex: round(boundedAdjusted * decimalMultiplier),
    warnings: baseWarnings(),
  };
}

export function americanImpliedProbability(odds: number): number {
  if (!Number.isFinite(odds) || Math.abs(odds) < 100) return 0;
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

export function americanToDecimal(odds: number): number {
  if (!Number.isFinite(odds) || Math.abs(odds) < 100) return 1;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds;
}

export function deViggedProbability(
  primaryOdds: number,
  oppositeOdds: number | null,
): number {
  const primary = americanImpliedProbability(primaryOdds);
  if (!oppositeOdds) return primary;
  const opposite = americanImpliedProbability(oppositeOdds);
  const total = primary + opposite;
  return total > 0 ? primary / total : primary;
}

export function marketHold(
  primaryOdds: number,
  oppositeOdds: number | null,
): number | null {
  if (!oppositeOdds) return null;
  return round(
    americanImpliedProbability(primaryOdds) +
      americanImpliedProbability(oppositeOdds) -
      1,
  );
}

function makeCandidate(
  profile: ParlayCandidate["profile"],
  legs: ManualOddsLeg[],
  correlationPenalty: number,
): ParlayCandidate {
  const scenario = analyzeManualParlayScenario(legs, correlationPenalty);
  const market = scenario.marketImpliedProbability;
  const penalty = Math.max(0, Math.min(0.5, correlationPenalty));
  const lowerIndependent = legs.reduce(
    (product, leg) =>
      product *
      Math.max(0.01, (leg.estimatedProbability ?? 0) - leg.uncertainty),
    1,
  );
  const upperIndependent = legs.reduce(
    (product, leg) =>
      product *
      Math.min(0.99, (leg.estimatedProbability ?? 0) + leg.uncertainty),
    1,
  );
  const adjustment = 1 - penalty * Math.max(0, legs.length - 1);
  return {
    ...scenario,
    profile,
    legs,
    estimatedEdgeLow: round(lowerIndependent * adjustment - market),
    estimatedEdgeHigh: round(upperIndependent * adjustment - market),
    uncertainty: round(
      legs.reduce((sum, leg) => sum + leg.uncertainty, 0) / legs.length,
    ),
    correlationModel: "user_penalty",
  };
}

function legEligibilityReason(
  leg: ManualOddsLeg,
  now: number,
  freshnessLimitMs: number,
  allowedPlayerIds: Set<string> | null,
): { kind: "watchlist" | "rejected"; text: string } | null {
  if (!leg.label.trim() || !leg.market) {
    return {
      kind: "watchlist",
      text: "Add a player, supplied market, current line, and current price.",
    };
  }
  if (
    !leg.sourceName.trim() ||
    !leg.bookOrConsensus.trim() ||
    !leg.recordedAt
  ) {
    return {
      kind: "watchlist",
      text: "Odds source, book or consensus identifier, and timestamp are required.",
    };
  }
  if (!isNumericallyValidLeg(leg)) {
    return {
      kind: "watchlist",
      text: "Current price and probability inputs are incomplete or invalid.",
    };
  }
  const recordedAt = Date.parse(leg.recordedAt);
  if (!Number.isFinite(recordedAt) || now - recordedAt > freshnessLimitMs) {
    return {
      kind: "watchlist",
      text: "The supplied price is stale; refresh it before construction.",
    };
  }
  if (recordedAt > now + 60_000) {
    return {
      kind: "rejected",
      text: "The supplied timestamp is in the future.",
    };
  }
  if (leg.availability === "out" || leg.availability === "inactive") {
    return {
      kind: "rejected",
      text: "Current injury or inactive status invalidates this leg.",
    };
  }
  if (
    allowedPlayerIds &&
    (!leg.playerId || !allowedPlayerIds.has(leg.playerId))
  ) {
    return {
      kind: "rejected",
      text: "The selected player is missing or no longer belongs to the current legal lineup pool.",
    };
  }
  return null;
}

function isNumericallyValidLeg(leg: ManualOddsLeg): boolean {
  return (
    Number.isFinite(leg.line) &&
    leg.americanOdds !== null &&
    Number.isFinite(leg.americanOdds) &&
    Math.abs(leg.americanOdds) >= 100 &&
    leg.estimatedProbability !== null &&
    Number.isFinite(leg.estimatedProbability) &&
    leg.estimatedProbability > 0 &&
    leg.estimatedProbability < 1 &&
    Number.isFinite(leg.uncertainty) &&
    leg.uncertainty >= 0 &&
    leg.uncertainty <= 0.5
  );
}

function fairMarketProbability(leg: ManualOddsLeg): number {
  return deViggedProbability(leg.americanOdds ?? 0, leg.oppositeAmericanOdds);
}

function legEdge(leg: ManualOddsLeg): { low: number; high: number } {
  const market = fairMarketProbability(leg);
  const estimated = leg.estimatedProbability ?? 0;
  return {
    low: estimated - leg.uncertainty - market,
    high: estimated + leg.uncertainty - market,
  };
}

function safeLabel(leg: ManualOddsLeg): string {
  return leg.label.trim() || "Incomplete manual leg";
}

function baseWarnings(): string[] {
  return [
    "Only current, user-supplied or licensed-source prices are analyzed; no market is invented.",
    "The correlation adjustment is a user-controlled conservative approximation, not a prediction.",
    "This uncertain entertainment analysis never places an action or recommends a monetary amount.",
  ];
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
