import type { Strategy } from "@/types/domain";

export type LeagueType = "redraft" | "keeper" | "dynasty" | "unknown";

export type DraftStyle =
  | "snake"
  | "linear"
  | "third_round_reversal"
  | "auction"
  | "manual_custom"
  | "unknown";

export type DraftPurpose =
  | "startup"
  | "rookie"
  | "veteran"
  | "supplemental"
  | "mixed"
  | "mock"
  | "unknown";

export type DraftPlayerPool =
  "all_available" | "rookies_only" | "veterans_only" | "manual" | "unknown";

export type LineupType = "classic" | "best_ball" | "unknown";

export type WaiverType =
  | "rolling"
  | "reverse_standings"
  | "faab"
  | "faab_with_rolling_tiebreak"
  | "custom_daily"
  | "free_agents"
  | "disabled"
  | "unknown";

export type TeamStrategy = Strategy;

export type FreshnessDomain =
  | "draft_picks"
  | "matchup"
  | "league_rosters"
  | "transactions"
  | "official_injuries"
  | "inactive_reports"
  | "weather"
  | "general_news"
  | "breaking_news"
  | "dynasty_profile"
  | "historical_data";

export type FreshnessState = "live" | "fresh" | "aging" | "stale" | "unknown";

export type DataFreshnessEntry = {
  domain: FreshnessDomain;
  fetchedAt: number | null;
  expiresAt: number | null;
  state: FreshnessState;
  sourceVersion?: string;
  lastError?: string;
};

export type DataFreshness = Partial<
  Record<FreshnessDomain, DataFreshnessEntry>
>;

export type LeagueContext = {
  leagueId: string;
  leagueName: string;
  season: string;
  week: number;
  userId: string;
  rosterId: number | null;
  leagueType: LeagueType;
  lineupType: LineupType;
  draftStyle: DraftStyle | null;
  waiverType: WaiverType;
  weeklyElimination: boolean;
  eliminationTiebreaker: string | null;
  rosterPositions: string[];
  scoringSettings: Record<string, number>;
  settings: Record<string, unknown>;
  strategy: TeamStrategy;
  selectedMatchupId: number | null;
  dataFreshness: DataFreshness;
};

export type LeagueWorkspaceState = {
  userId: string;
  leagueId: string;
  season: string;
  workspace: string;
  week: number;
  scrollTop: number;
  filters: Record<string, string | number | boolean | string[]>;
  strategy: TeamStrategy;
  updatedAt: number;
};

export type ManualLeagueOverrides = {
  leagueType?: LeagueType;
  lineupType?: LineupType;
  draftStyle?: DraftStyle;
  waiverType?: WaiverType;
  slotMappings?: Record<string, string[]>;
  scoringLabels?: Record<string, string>;
  taxiExperienceLimit?: number | null;
  taxiDeadline?: string | null;
  minimumAuctionBid?: number;
  weeklyElimination?: boolean;
  eliminationTiebreaker?: string | null;
};

export type CapabilityDiagnostic = {
  kind: "unknown_setting" | "unknown_scoring" | "unknown_roster_slot";
  key: string;
  value: unknown;
  severity: "info" | "warning";
  message: string;
};

export type SleeperCapabilities = {
  leagueType: LeagueType;
  lineupType: LineupType;
  draftStyle: DraftStyle | null;
  draftPurpose: DraftPurpose | null;
  playerPool: DraftPlayerPool | null;
  waiverType: WaiverType;
  leagueMedian: boolean;
  superflex: boolean;
  tightEndPremium: boolean;
  pointsPerFirstDown: boolean;
  idp: boolean;
  taxi: boolean;
  injuredReserve: boolean;
  tradesEnabled: boolean;
  waiversEnabled: boolean;
  weeklyElimination: boolean;
  eliminationTiebreaker: string | null;
  rosterPositions: string[];
  knownScoringKeys: string[];
  unknownScoringKeys: string[];
  unknownRosterSlots: string[];
  diagnostics: CapabilityDiagnostic[];
};

export type EvidenceClass =
  | "official_league"
  | "official_nfl"
  | "official_team"
  | "official_injury_report"
  | "official_transaction"
  | "weather"
  | "schedule"
  | "historical_stats"
  | "projection"
  | "market"
  | "national_reporter"
  | "beat_reporter"
  | "public_social"
  | "analysis"
  | "user_import"
  | "user_override";

export type EvidenceNature =
  "fact" | "report" | "opinion" | "projection" | "inference";

export type EvidenceConflict = {
  evidenceId: string;
  summary: string;
};

export type EvidenceItem = {
  id: string;
  sourceClass: EvidenceClass;
  url: string;
  publisher: string;
  author?: string;
  publishedAt: string | null;
  retrievedAt: string;
  eventAt?: string | null;
  playerIds: string[];
  teamIds: string[];
  claimType: string;
  claim: string;
  confidence: number;
  freshness: FreshnessState;
  corroborationCount: number;
  contradictions: EvidenceConflict[];
  citation: string;
  expiresAt: string;
  rawSourceHash: string;
  nature: EvidenceNature;
};

export type DecisionFactor = {
  id: string;
  label: string;
  contribution: number;
  explanation: string;
  evidenceIds: string[];
};

export type DecisionRisk = {
  id: string;
  label: string;
  severity: "low" | "moderate" | "high";
  explanation: string;
};

export type PendingNews = {
  id: string;
  label: string;
  expectedAt: string | null;
  impact: string;
};

export type Citation = {
  evidenceId: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
};

export type StartSitRecommendation = {
  leagueId: string;
  week: number;
  generatedAt: string;
  expiresAt: string;
  slot: string;
  startPlayerId: string;
  sitPlayerIds: string[];
  projectedAdvantage: number;
  floorAdvantage: number;
  ceilingAdvantage: number;
  confidence: number;
  status: "clear" | "lean" | "coin_flip" | "wait_for_news";
  decisionDeadline: string | null;
  keyFactors: DecisionFactor[];
  risks: DecisionRisk[];
  pendingNews: PendingNews[];
  citations: Citation[];
};
