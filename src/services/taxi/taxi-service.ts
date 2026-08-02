export type TaxiRules = {
  slots: number;
  experienceLimit: number | null;
  allowNonRookies: boolean;
  deadline: string | null;
  canReturnAfterPromotion: boolean;
  manualEligiblePlayerIds?: string[];
};

export type TaxiPlayer = {
  playerId: string;
  name: string;
  position: string;
  yearsExperience: number | null;
  isRookie: boolean;
  onTaxi: boolean;
  currentProductionNeed: number;
  developmentValue: number;
  rosterValue: number;
  idp?: boolean;
};

export type TaxiRecommendation = {
  playerId: string;
  eligible: boolean;
  action:
    | "taxi"
    | "keep_active"
    | "promote"
    | "cut"
    | "trade"
    | "hold_through_deadline";
  opportunityCost: number;
  eligibilityExpiresAfterSeason: boolean;
  rationale: string[];
};

export function isTaxiEligible(player: TaxiPlayer, rules: TaxiRules): boolean {
  if (rules.manualEligiblePlayerIds?.includes(player.playerId)) return true;
  if (rules.slots <= 0) return false;
  if (!rules.allowNonRookies && !player.isRookie) return false;
  if (
    rules.experienceLimit !== null &&
    player.yearsExperience !== null &&
    player.yearsExperience > rules.experienceLimit
  ) {
    return false;
  }
  return true;
}

export function recommendTaxi(
  player: TaxiPlayer,
  rules: TaxiRules,
  now = Date.now(),
): TaxiRecommendation {
  const eligible = isTaxiEligible(player, rules);
  if (!eligible) {
    return {
      playerId: player.playerId,
      eligible: false,
      action: player.rosterValue >= 60 ? "keep_active" : "cut",
      opportunityCost: 0,
      eligibilityExpiresAfterSeason: false,
      rationale: [
        "The player does not satisfy the selected league's taxi eligibility rules.",
      ],
    };
  }
  const deadline = rules.deadline ? Date.parse(rules.deadline) : Number.NaN;
  const nearDeadline =
    Number.isFinite(deadline) && deadline - now <= 72 * 60 * 60_000;
  const opportunityCost = round(
    Math.max(0, player.currentProductionNeed - player.developmentValue * 0.35),
  );
  const action = player.onTaxi
    ? player.currentProductionNeed >= 75
      ? "promote"
      : nearDeadline && !rules.canReturnAfterPromotion
        ? "hold_through_deadline"
        : "taxi"
    : player.currentProductionNeed >= 70
      ? "keep_active"
      : player.developmentValue >= 52
        ? "taxi"
        : player.rosterValue >= 45
          ? "trade"
          : "cut";
  return {
    playerId: player.playerId,
    eligible,
    action,
    opportunityCost,
    eligibilityExpiresAfterSeason:
      rules.experienceLimit !== null &&
      player.yearsExperience !== null &&
      player.yearsExperience >= rules.experienceLimit,
    rationale: [
      `${Math.round(player.developmentValue)} development value`,
      `${Math.round(player.currentProductionNeed)} current production need`,
      player.idp
        ? "IDP eligibility retained"
        : "Offensive eligibility retained",
    ],
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
