import { KNOWN_SCORING_KEYS } from "@/config/sleeper-capabilities";

export type ScoringComponent = {
  key: string;
  label: string;
  stat: number | null;
  multiplier: number;
  points: number | null;
  supported: boolean;
};

export type FantasyScoreResult = {
  points: number | null;
  components: ScoringComponent[];
  unsupportedKeys: string[];
  unknownKeys: string[];
  usedImportedProjection: boolean;
  summary: string;
};

const SCORING_LABELS: Record<string, string> = {
  pass_yd: "Passing yards",
  pass_td: "Passing touchdowns",
  pass_int: "Interceptions thrown",
  pass_2pt: "Passing two-point conversions",
  pass_cmp: "Pass completions",
  pass_att: "Pass attempts",
  pass_inc: "Incomplete passes",
  pass_sack: "Sacks taken",
  pass_fd: "Passing first downs",
  rush_yd: "Rushing yards",
  rush_td: "Rushing touchdowns",
  rush_att: "Rushing attempts",
  rush_fd: "Rushing first downs",
  rush_2pt: "Rushing two-point conversions",
  rec: "Receptions",
  rec_yd: "Receiving yards",
  rec_td: "Receiving touchdowns",
  rec_fd: "Receiving first downs",
  rec_2pt: "Receiving two-point conversions",
  fum: "Fumbles",
  fum_lost: "Fumbles lost",
  fum_rec_td: "Fumble-recovery touchdowns",
  fgm: "Field goals made",
  fgmiss: "Field goals missed",
  xpm: "Extra points made",
  xpmiss: "Extra points missed",
  sack: "Sacks",
  int: "Interceptions",
  ff: "Forced fumbles",
  fum_rec: "Fumble recoveries",
  safe: "Safeties",
  blk_kick: "Blocked kicks",
  tkl: "Total tackles",
  tkl_solo: "Solo tackles",
  tkl_ast: "Assisted tackles",
  tkl_loss: "Tackles for loss",
  qb_hit: "Quarterback hits",
  pass_def: "Passes defended",
  int_ret_yd: "Interception return yards",
  fum_ret_yd: "Fumble return yards",
  idp_def_td: "Individual defensive touchdowns",
  def_td: "Team defensive touchdowns",
  st_td: "Individual special-teams touchdowns",
  def_st_td: "Team special-teams touchdowns",
  kr_yd: "Kick-return yards",
  pr_yd: "Punt-return yards",
  def_kr_yd: "Team kick-return yards",
  def_pr_yd: "Team punt-return yards",
};

export function calculateFantasyScore(input: {
  scoringSettings: Record<string, number>;
  rawStats: Record<string, number | null | undefined>;
  importedProjection?: number | null;
  customLabels?: Record<string, string>;
}): FantasyScoreResult {
  const components = Object.entries(input.scoringSettings)
    .filter(([, multiplier]) => Number.isFinite(multiplier) && multiplier !== 0)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, multiplier]): ScoringComponent => {
      const value = input.rawStats[key];
      const supported = typeof value === "number" && Number.isFinite(value);
      return {
        key,
        label: scoringLabel(key, input.customLabels),
        stat: supported ? value : null,
        multiplier,
        points: supported ? value * multiplier : null,
        supported,
      };
    });
  const unsupportedKeys = components
    .filter((component) => !component.supported)
    .map((component) => component.key);
  const unknownKeys = components
    .filter((component) => !KNOWN_SCORING_KEYS.has(component.key))
    .map((component) => component.key);
  const calculated = components.reduce(
    (sum, component) => sum + (component.points ?? 0),
    0,
  );
  const complete = unsupportedKeys.length === 0;
  const imported = input.importedProjection;
  const usedImportedProjection =
    !complete && typeof imported === "number" && Number.isFinite(imported);
  const points = complete
    ? round(calculated)
    : usedImportedProjection
      ? round(imported)
      : null;
  return {
    points,
    components,
    unsupportedKeys,
    unknownKeys,
    usedImportedProjection,
    summary: summarizeScoring(input.scoringSettings, input.customLabels),
  };
}

export function summarizeScoring(
  scoringSettings: Record<string, number>,
  customLabels: Record<string, string> = {},
): string {
  const active = Object.entries(scoringSettings)
    .filter(([, value]) => Number.isFinite(value) && value !== 0)
    .toSorted(([left], [right]) => left.localeCompare(right));
  if (active.length === 0)
    return "No non-zero scoring categories were provided.";
  return active
    .map(
      ([key, value]) =>
        `${scoringLabel(key, customLabels)} ${formatMultiplier(value)}`,
    )
    .join(" · ");
}

export function scoringLabel(
  key: string,
  customLabels: Record<string, string> = {},
): string {
  return (
    customLabels[key] ??
    SCORING_LABELS[key] ??
    key
      .split("_")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ")
  );
}

function formatMultiplier(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number.isInteger(value) ? value : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} pts`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
