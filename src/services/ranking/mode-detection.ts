import type { DraftMode, LeagueFormat } from "@/types/domain";

type DetectionInput = {
  leagueType?: number;
  leagueSettings?: Record<string, unknown>;
  scoringSettings?: Record<string, unknown>;
  rosterPositions?: string[];
  draftType?: string;
  draftStatus?: string;
  draftRounds?: number;
  playerPool?: string[];
  keepers?: string[];
  taxiSlots?: number;
  existingOwnedPlayerCount?: number;
  manualOverride?: DraftMode;
};

export type ModeDetection = {
  mode: DraftMode;
  confidence: number;
  evidence: string[];
  warnings: string[];
};

type WeightedMode = {
  mode: DraftMode;
  weight: number;
  evidence: string;
};

export function detectDraftMode(input: DetectionInput): ModeDetection {
  if (input.manualOverride && input.manualOverride !== "unknown") {
    return {
      mode: input.manualOverride,
      confidence: 1,
      evidence: ["Manual override"],
      warnings: [],
    };
  }

  const signals: WeightedMode[] = [];
  const settings = input.leagueSettings ?? {};
  const draftType = input.draftType?.toLowerCase() ?? "";
  const playerPool = new Set(input.playerPool ?? []);

  if (input.leagueType === 2 || settings["type"] === 2) {
    signals.push({
      mode: "dynasty_startup",
      weight: 3,
      evidence: "League is configured as dynasty",
    });
  }
  if ((input.taxiSlots ?? 0) > 0) {
    signals.push({
      mode: "dynasty_startup",
      weight: 1.5,
      evidence: "Taxi slots are configured",
    });
  }
  if ((input.existingOwnedPlayerCount ?? 0) > 24 && playerPool.has("rookies")) {
    signals.push({
      mode: "dynasty_rookie",
      weight: 5,
      evidence: "Established rosters and rookie-only player pool",
    });
  } else if (playerPool.has("rookies")) {
    signals.push({
      mode: "dynasty_rookie",
      weight: 4,
      evidence: "Draft player pool is rookie-only",
    });
  }
  if ((input.keepers?.length ?? 0) > 0 || draftType.includes("keeper")) {
    signals.push({
      mode: "keeper",
      weight: 4,
      evidence: "Keeper markers are present",
    });
  }
  if (
    settings["best_ball"] === 1 ||
    settings["best_ball"] === true ||
    draftType.includes("best")
  ) {
    signals.push({
      mode: "best_ball",
      weight: 5,
      evidence: "Best ball setting is enabled",
    });
  }
  if (input.leagueType === 0 || input.leagueType === 1) {
    signals.push({
      mode: "redraft",
      weight: 2.5,
      evidence: "League is seasonal",
    });
  }
  if ((input.draftRounds ?? 0) >= 14 && playerPool.has("veterans")) {
    signals.push({
      mode: input.leagueType === 2 ? "dynasty_startup" : "redraft",
      weight: 2,
      evidence: "Full roster draft with veteran player pool",
    });
  }

  if (signals.length === 0) {
    return {
      mode: "unknown",
      confidence: 0,
      evidence: [],
      warnings: ["Available metadata is insufficient to determine draft mode."],
    };
  }

  const totals = new Map<DraftMode, number>();
  for (const signal of signals) {
    totals.set(signal.mode, (totals.get(signal.mode) ?? 0) + signal.weight);
  }
  const ranked = [...totals.entries()].toSorted((a, b) => b[1] - a[1]);
  const winner = ranked[0];
  if (!winner) {
    return {
      mode: "unknown",
      confidence: 0,
      evidence: [],
      warnings: ["Draft mode signals could not be ranked."],
    };
  }

  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const confidence = Math.min(
    0.99,
    winner[1] / Math.max(totalWeight, winner[1]),
  );
  const conflicting = ranked
    .slice(1)
    .filter((entry) => entry[1] >= winner[1] * 0.6);

  return {
    mode: winner[0],
    confidence,
    evidence: signals
      .filter((signal) => signal.mode === winner[0])
      .map((signal) => signal.evidence),
    warnings:
      conflicting.length > 0
        ? [
            `Conflicting signals also suggest ${conflicting
              .map(([mode]) => mode.replaceAll("_", " "))
              .join(", ")}.`,
          ]
        : [],
  };
}

export function detectLeagueFormat(input: DetectionInput): LeagueFormat {
  const roster = input.rosterPositions ?? [];
  const scoring = input.scoringSettings ?? {};
  const settings = input.leagueSettings ?? {};
  const mode = detectDraftMode(input).mode;
  const count = (position: string) =>
    roster.filter((value) => value === position).length;
  const receptions = numericSetting(scoring["rec"]);
  const tightEndReceptions =
    numericSetting(scoring["bonus_rec_te"]) +
    Math.max(0, numericSetting(scoring["rec_te"]) - receptions);
  const firstDown =
    numericSetting(scoring["pass_fd"]) +
    numericSetting(scoring["rush_fd"]) +
    numericSetting(scoring["rec_fd"]);
  const idpPositions = new Set([
    "DL",
    "LB",
    "DB",
    "IDP",
    "DE",
    "DT",
    "CB",
    "S",
  ]);

  return {
    teams: Math.max(2, numericSetting(settings["num_teams"]) || 12),
    mode,
    scoring:
      receptions >= 0.9
        ? "ppr"
        : receptions >= 0.4
          ? "half_ppr"
          : receptions === 0
            ? "standard"
            : "custom",
    superflex: roster.some((value) => value === "SUPER_FLEX"),
    twoQuarterback: count("QB") >= 2,
    tightEndPremium: tightEndReceptions > 0,
    pointsPerFirstDown: firstDown > 0,
    bestBall:
      mode === "best_ball" ||
      settings["best_ball"] === 1 ||
      settings["best_ball"] === true,
    idp: roster.some((value) => idpPositions.has(value)),
    starters: Object.fromEntries(
      [...new Set(roster)]
        .filter((position) => !["BN", "TAXI", "IR"].includes(position))
        .map((position) => [position, count(position)]),
    ),
    bench: count("BN"),
    taxi: count("TAXI") || numericSetting(settings["taxi_slots"]),
    injuredReserve: count("IR") || numericSetting(settings["reserve_slots"]),
  };
}

function numericSetting(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
