export type IdpRoleInput = {
  position: string;
  age: number | null;
  snapShare: number | null;
  threeDownRole: boolean | null;
  tackleOpportunities: number | null;
  pressureOpportunities: number | null;
  boxSnapShare: number | null;
  blitzRate: number | null;
  injuryPenalty: number;
  roleStability: number | null;
};

export type IdpProjection = {
  tackleFloor: number;
  bigPlayCeiling: number;
  roleStability: number;
  weeklyExpectedPoints: number;
  dynastyValue: number;
  confidence: number;
  assumptions: string[];
  scoringComponents: Record<string, number>;
};

export function projectIdpPlayer(input: {
  role: IdpRoleInput;
  scoring: Record<string, number>;
}): IdpProjection {
  const base = positionBaseline(input.role.position);
  const snapShare = input.role.snapShare ?? base.snapShare;
  const tackles =
    input.role.tackleOpportunities ??
    base.tackles * clamp(snapShare / base.snapShare, 0.35, 1.3);
  const pressures = input.role.pressureOpportunities ?? base.pressures;
  const boxShare = input.role.boxSnapShare ?? base.boxShare;
  const blitzRate = input.role.blitzRate ?? base.blitzRate;
  const solo = tackles * 0.68;
  const assisted = tackles * 0.32;
  const sacks = pressures * (0.055 + blitzRate * 0.08);
  const passesDefended = base.coverageEvents * (1 - boxShare * 0.25);
  const scoringComponents = {
    tackles:
      solo * score(input.scoring, ["tkl_solo", "tkl"], 1) +
      assisted * score(input.scoring, ["tkl_ast"], 0.5),
    sacks: sacks * score(input.scoring, ["sack"], 2),
    tacklesForLoss: tackles * 0.09 * score(input.scoring, ["tkl_loss"], 1),
    qbHits: pressures * 0.22 * score(input.scoring, ["qb_hit"], 0),
    passesDefended: passesDefended * score(input.scoring, ["pass_def"], 1.5),
    turnovers:
      base.turnoverEvents *
      (score(input.scoring, ["int"], 3) +
        score(input.scoring, ["ff"], 2) * 0.65 +
        score(input.scoring, ["fum_rec"], 2) * 0.35),
  };
  const raw = Object.values(scoringComponents).reduce(
    (sum, value) => sum + value,
    0,
  );
  const injuryMultiplier = clamp(1 - input.role.injuryPenalty, 0, 1);
  const threeDownMultiplier =
    input.role.threeDownRole === true
      ? 1.08
      : input.role.threeDownRole === false
        ? 0.82
        : 1;
  const expected = raw * injuryMultiplier * threeDownMultiplier;
  const stability = clamp(
    input.role.roleStability ??
      snapShare * 0.72 + (input.role.threeDownRole ? 0.18 : 0),
    0,
    1,
  );
  const known = [
    input.role.snapShare,
    input.role.threeDownRole,
    input.role.tackleOpportunities,
    input.role.pressureOpportunities,
    input.role.boxSnapShare,
    input.role.blitzRate,
    input.role.roleStability,
  ].filter((value) => value !== null).length;
  const assumptions: string[] = [];
  if (input.role.snapShare === null)
    assumptions.push("Snap share unavailable; position baseline used.");
  if (input.role.threeDownRole === null)
    assumptions.push(
      "Three-down role unavailable; no role multiplier applied.",
    );
  if (input.role.tackleOpportunities === null)
    assumptions.push("Tackle opportunity unavailable; position baseline used.");
  if (input.role.pressureOpportunities === null)
    assumptions.push(
      "Pressure opportunity unavailable; position baseline used.",
    );

  return {
    tackleFloor: round(expected * (0.62 + stability * 0.12)),
    bigPlayCeiling: round(expected * (1.32 + pressures * 0.015)),
    roleStability: round(stability),
    weeklyExpectedPoints: round(expected),
    dynastyValue: round(
      clamp(
        expected * 5 +
          (input.role.age === null ? 0 : (27 - input.role.age) * 2.5),
        0,
        100,
      ),
    ),
    confidence: round(0.32 + known * 0.075),
    assumptions,
    scoringComponents: Object.fromEntries(
      Object.entries(scoringComponents).map(([key, value]) => [
        key,
        round(value),
      ]),
    ),
  };
}

function positionBaseline(position: string) {
  if (["LB", "ILB", "OLB"].includes(position))
    return {
      snapShare: 0.76,
      tackles: 7.2,
      pressures: 3.1,
      boxShare: 0.62,
      blitzRate: 0.18,
      coverageEvents: 0.42,
      turnoverEvents: 0.08,
    };
  if (["DL", "DE", "DT", "EDGE"].includes(position))
    return {
      snapShare: 0.68,
      tackles: 3.1,
      pressures: 5.4,
      boxShare: 0.82,
      blitzRate: 0.05,
      coverageEvents: 0.08,
      turnoverEvents: 0.06,
    };
  return {
    snapShare: 0.78,
    tackles: 5.3,
    pressures: 1.2,
    boxShare: 0.38,
    blitzRate: 0.09,
    coverageEvents: 0.75,
    turnoverEvents: 0.11,
  };
}

function score(
  scoring: Record<string, number>,
  keys: string[],
  fallback: number,
): number {
  for (const key of keys) {
    const value = scoring[key];
    if (typeof value === "number") return value;
  }
  return fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
