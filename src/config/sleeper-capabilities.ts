import type { SleeperDraft, SleeperLeague } from "@/schemas/sleeper";
import type {
  CapabilityDiagnostic,
  DraftPlayerPool,
  DraftPurpose,
  DraftStyle,
  LeagueType,
  LineupType,
  ManualLeagueOverrides,
  SleeperCapabilities,
  WaiverType,
} from "@/types/league";

export const OFFENSIVE_ROSTER_SLOTS = new Set([
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "BN",
  "IR",
  "TAXI",
  "FLEX",
  "WRRB_FLEX",
  "REC_FLEX",
  "SUPER_FLEX",
]);

export const IDP_ROSTER_SLOTS = new Set([
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
  "IDP_FLEX",
]);

export const KNOWN_SCORING_KEYS = new Set([
  "pass_yd",
  "pass_td",
  "pass_int",
  "pass_2pt",
  "pass_cmp",
  "pass_att",
  "pass_inc",
  "pass_sack",
  "pass_fd",
  "rush_yd",
  "rush_td",
  "rush_att",
  "rush_fd",
  "rush_2pt",
  "rec",
  "rec_yd",
  "rec_td",
  "rec_fd",
  "rec_2pt",
  "rec_0_4",
  "rec_5_9",
  "rec_10_19",
  "rec_20_29",
  "rec_30_39",
  "rec_40p",
  "fum",
  "fum_lost",
  "fum_rec_td",
  "bonus_pass_yd_300",
  "bonus_pass_yd_400",
  "bonus_rush_yd_100",
  "bonus_rush_yd_200",
  "bonus_rec_yd_100",
  "bonus_rec_yd_200",
  "bonus_pass_cmp_25",
  "bonus_rush_att_20",
  "bonus_rec_te",
  "fgm",
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm_50p",
  "fgmiss",
  "xpm",
  "xpmiss",
  "def_td",
  "def_st_td",
  "def_st_ff",
  "def_st_fum_rec",
  "def_st_yd",
  "def_kr_yd",
  "def_pr_yd",
  "pts_allow_0",
  "pts_allow_1_6",
  "pts_allow_7_13",
  "pts_allow_14_20",
  "pts_allow_21_27",
  "pts_allow_28_34",
  "pts_allow_35p",
  "yds_allow_0_100",
  "yds_allow_100_199",
  "yds_allow_200_299",
  "yds_allow_300_349",
  "yds_allow_350_399",
  "yds_allow_400_449",
  "yds_allow_450_499",
  "yds_allow_500_549",
  "yds_allow_550p",
  "sack",
  "int",
  "ff",
  "fum_rec",
  "safe",
  "blk_kick",
  "tkl",
  "tkl_solo",
  "tkl_ast",
  "tkl_loss",
  "qb_hit",
  "pass_def",
  "int_ret_yd",
  "fum_ret_yd",
  "idp_def_td",
  "st_td",
  "st_ff",
  "st_fum_rec",
  "kr_yd",
  "pr_yd",
]);

const KNOWN_SETTING_KEYS = new Set([
  "type",
  "best_ball",
  "waiver_type",
  "waiver_budget",
  "waiver_clear_days",
  "waiver_day_of_week",
  "daily_waivers",
  "daily_waivers_days",
  "daily_waivers_hour",
  "disable_adds",
  "disable_trades",
  "trade_deadline",
  "taxi_slots",
  "taxi_years",
  "reserve_slots",
  "league_average_match",
  "playoff_teams",
  "playoff_week_start",
  "playoff_type",
  "max_keepers",
  "draft_rounds",
  "num_teams",
  "leg",
  "weekly_elimination",
  "elimination",
  "guillotine",
  "chopped",
  "elimination_tiebreaker",
  "chop_tiebreaker",
]);

export function detectSleeperCapabilities(
  league: SleeperLeague,
  draft?: SleeperDraft | null,
  overrides: ManualLeagueOverrides = {},
): SleeperCapabilities {
  const settings = league.settings;
  const rosterPositions = league.roster_positions.map(normalizeKey);
  const scoring = numericRecord(league.scoring_settings);
  const leagueType = overrides.leagueType ?? detectLeagueType(settings);
  const lineupType = overrides.lineupType ?? detectLineupType(settings);
  const waiverType = overrides.waiverType ?? detectWaiverType(settings);
  const draftStyle =
    overrides.draftStyle ?? (draft ? detectDraftStyle(draft) : null);
  const unknownRosterSlots = rosterPositions.filter(
    (slot) => !OFFENSIVE_ROSTER_SLOTS.has(slot) && !IDP_ROSTER_SLOTS.has(slot),
  );
  const knownScoringKeys = Object.keys(scoring).filter((key) =>
    KNOWN_SCORING_KEYS.has(key),
  );
  const unknownScoringKeys = Object.entries(scoring)
    .filter(([key, value]) => value !== 0 && !KNOWN_SCORING_KEYS.has(key))
    .map(([key]) => key);
  const diagnostics: CapabilityDiagnostic[] = [
    ...unknownRosterSlots.map((key) => ({
      kind: "unknown_roster_slot" as const,
      key,
      value: key,
      severity: "warning" as const,
      message: `Roster slot ${key} is retained and needs a manual eligibility mapping.`,
    })),
    ...unknownScoringKeys.map((key) => ({
      kind: "unknown_scoring" as const,
      key,
      value: scoring[key],
      severity: "warning" as const,
      message: `Non-zero scoring key ${key} is retained; raw-stat coverage is diagnosed at calculation time.`,
    })),
    ...Object.entries(settings)
      .filter(([key]) => !KNOWN_SETTING_KEYS.has(key))
      .map(([key, value]) => ({
        kind: "unknown_setting" as const,
        key,
        value,
        severity: "info" as const,
        message: `Unrecognized Sleeper setting ${key} is preserved for diagnostics.`,
      })),
  ];

  return {
    leagueType,
    lineupType,
    draftStyle,
    draftPurpose: draft ? detectDraftPurpose(draft) : null,
    playerPool: draft ? detectPlayerPool(draft) : null,
    waiverType,
    leagueMedian: numberSetting(settings, "league_average_match") > 0,
    superflex: rosterPositions.includes("SUPER_FLEX"),
    tightEndPremium: detectTePremium(scoring),
    pointsPerFirstDown: Object.entries(scoring).some(
      ([key, value]) => key.endsWith("_fd") && value !== 0,
    ),
    idp: rosterPositions.some((slot) => IDP_ROSTER_SLOTS.has(slot)),
    taxi:
      numberSetting(settings, "taxi_slots") > 0 ||
      rosterPositions.includes("TAXI"),
    injuredReserve:
      numberSetting(settings, "reserve_slots") > 0 ||
      rosterPositions.includes("IR"),
    tradesEnabled: numberSetting(settings, "disable_trades") !== 1,
    waiversEnabled: waiverType !== "disabled",
    weeklyElimination:
      overrides.weeklyElimination ?? detectWeeklyElimination(settings),
    eliminationTiebreaker:
      overrides.eliminationTiebreaker ?? detectEliminationTiebreaker(settings),
    rosterPositions,
    knownScoringKeys,
    unknownScoringKeys,
    unknownRosterSlots,
    diagnostics,
  };
}

export function detectWeeklyElimination(
  settings: Record<string, unknown>,
): boolean {
  return ["weekly_elimination", "elimination", "guillotine", "chopped"].some(
    (key) => numberSetting(settings, key) === 1,
  );
}

function detectEliminationTiebreaker(
  settings: Record<string, unknown>,
): string | null {
  for (const key of ["elimination_tiebreaker", "chop_tiebreaker"]) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function detectLeagueType(
  settings: Record<string, unknown>,
): LeagueType {
  const value = numberSetting(settings, "type", -1);
  if (value === 0) return "redraft";
  if (value === 1) return "keeper";
  if (value === 2) return "dynasty";
  return "unknown";
}

export function detectLineupType(
  settings: Record<string, unknown>,
): LineupType {
  const value = numberSetting(settings, "best_ball", -1);
  if (value === 1) return "best_ball";
  if (value === 0 || value === -1) return "classic";
  return "unknown";
}

export function detectWaiverType(
  settings: Record<string, unknown>,
): WaiverType {
  if (numberSetting(settings, "disable_adds") === 1) return "disabled";
  if (numberSetting(settings, "daily_waivers") > 0) return "custom_daily";
  const value = numberSetting(settings, "waiver_type", -1);
  const budget = numberSetting(settings, "waiver_budget");
  if (value === 2) return "faab_with_rolling_tiebreak";
  if (value === 1 && budget > 0) return "faab";
  if (value === 1) return "reverse_standings";
  if (value === 0) return "rolling";
  if (value === 3) return "free_agents";
  return "unknown";
}

export function detectDraftStyle(draft: SleeperDraft): DraftStyle {
  if (draft.type === "auction") return "auction";
  if (draft.type === "linear") return "linear";
  if (draft.type === "snake") {
    return numberSetting(draft.settings, "reversal_round") === 3
      ? "third_round_reversal"
      : "snake";
  }
  if (draft.type === "manual" || draft.type === "custom") {
    return "manual_custom";
  }
  return "unknown";
}

export function detectDraftPurpose(draft: SleeperDraft): DraftPurpose {
  const raw = stringMetadata(draft.metadata, ["draft_type", "type", "purpose"]);
  const name = stringMetadata(draft.metadata, ["name"]).toLowerCase();
  if (raw.includes("rookie") || name.includes("rookie")) return "rookie";
  if (raw.includes("supplemental") || name.includes("supplemental"))
    return "supplemental";
  if (raw.includes("veteran") || raw.includes("vet")) return "veteran";
  if (raw.includes("startup") || name.includes("startup")) return "startup";
  if (raw.includes("mock") || name.includes("mock")) return "mock";
  if (raw.includes("mixed") || raw.includes("all")) return "mixed";
  return "unknown";
}

export function detectPlayerPool(draft: SleeperDraft): DraftPlayerPool {
  const raw = stringMetadata(draft.metadata, [
    "player_pool",
    "draft_type",
    "type",
  ]);
  if (raw.includes("rookie")) return "rookies_only";
  if (raw.includes("veteran") || raw.includes("vet")) return "veterans_only";
  if (raw.includes("manual")) return "manual";
  if (raw.includes("all") || detectDraftPurpose(draft) === "startup") {
    return "all_available";
  }
  return "unknown";
}

function detectTePremium(scoring: Record<string, number>): boolean {
  const base = scoring["rec"] ?? 0;
  return Object.entries(scoring).some(
    ([key, value]) =>
      (key === "bonus_rec_te" || key === "rec_te" || key.endsWith("_te")) &&
      value > base,
  );
}

function numericRecord(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const number = typeof entry === "number" ? entry : Number(entry);
      return Number.isFinite(number) ? [[key, number]] : [];
    }),
  );
}

function numberSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback = 0,
): number {
  const value = settings[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringMetadata(
  metadata: Record<string, unknown>,
  keys: string[],
): string {
  return keys
    .map((key) => metadata[key])
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}
