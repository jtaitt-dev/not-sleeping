export type DraftMode =
  | "redraft"
  | "keeper"
  | "dynasty_startup"
  | "dynasty_rookie"
  | "best_ball"
  | "unknown";

export type Strategy =
  "contender" | "balanced" | "productive_struggle" | "rebuild";

export type Position =
  "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DEF" | "DL" | "LB" | "DB";

export type Player = {
  id: string;
  sleeperId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  normalizedName: string;
  position: Position;
  team?: string;
  age?: number;
  yearsExperience?: number;
  status: "active" | "inactive" | "injured" | "unknown";
  injuryStatus?: string;
  college?: string;
  nflDraftYear?: number;
  nflDraftRound?: number;
  nflDraftPick?: number;
  searchRank?: number;
  fantasyPositions: Position[];
};

export type LeagueFormat = {
  teams: number;
  mode: DraftMode;
  scoring: "standard" | "half_ppr" | "ppr" | "custom";
  superflex: boolean;
  twoQuarterback: boolean;
  tightEndPremium: boolean;
  pointsPerFirstDown: boolean;
  bestBall: boolean;
  idp: boolean;
  starters: Record<string, number>;
  bench: number;
  taxi: number;
  injuredReserve: number;
};

export type DraftPick = {
  pickNumber: number;
  round: number;
  pickInRound: number;
  playerId: string;
  playerName: string;
  position: Position;
  team?: string;
  rosterId?: string;
  pickedBy?: string;
  isKeeper: boolean;
  isUserPick: boolean;
  timestamp?: number;
};

export type DraftContext = {
  supported: boolean;
  source: "sleeper" | "manual" | "demo";
  url?: string;
  userId?: string;
  username?: string;
  leagueId?: string;
  leagueName?: string;
  draftId?: string;
  draftName?: string;
  rosterId?: string;
  mode: DraftMode;
  modeConfidence: number;
  modeEvidence: string[];
  currentPick: number;
  currentRound: number;
  currentDrafter?: string;
  nextUserPick?: number;
  picksUntilUser?: number;
  secondsRemaining?: number;
  status: "pre_draft" | "drafting" | "paused" | "complete" | "unknown";
  lastUpdatedAt: number;
  connected: boolean;
};

export type LiveDraftState = {
  context: DraftContext;
  format: LeagueFormat;
  picks: DraftPick[];
  players: Player[];
  fetchedAt: number;
  playerIndexStale: boolean;
};

export type KeyStatus = {
  available: boolean;
  mode: KeyMode | null;
  masked: string | null;
};

export type ScoreComponent = {
  key: string;
  label: string;
  value: number;
  reason: string;
};

export type Recommendation = {
  player: Player;
  rank: number;
  tier: number;
  localScore: number;
  researchAdjustment: number;
  contextualScore: number;
  confidence: number;
  valueOverReplacement: number;
  rosterFit: "weak" | "neutral" | "strong";
  scarcity: number;
  nextPickAvailability: number;
  risk: "low" | "moderate" | "high";
  rationale: string;
  researchFreshness?: number;
  cited: boolean;
  components: ScoreComponent[];
};

export type SourceCitation = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publicationDate?: string;
  accessedAt: number;
  claims: string[];
};

export type PlayerResearch = {
  playerId: string;
  researchedAt: number;
  expiresAt: number;
  searchContext: string;
  currentTeam?: string;
  currentRole: string;
  depthChart: string[];
  injuryStatus: string;
  recentUpdates: string[];
  transactions: string[];
  contractContext?: string;
  schemeContext: string;
  recentPerformance: string;
  redraftOutlook: string;
  dynastyOutlook: string;
  rookieOutlook?: string;
  contenderFit: string;
  rebuilderFit: string;
  bullCase: string[];
  bearCase: string[];
  riskFactors: string[];
  conflictingReports: string[];
  unknownFacts: string[];
  confidence: number;
  citations: SourceCitation[];
  cited: boolean;
};

export type KeyMode = "session" | "remembered";

export type Theme = "dark" | "light" | "system" | "high_contrast";

export type AppSettings = {
  settingsVersion: number;
  onboardingComplete: boolean;
  sleeperUsername: string;
  sleeperUserId: string;
  defaultMode: DraftMode;
  modeOverrides: Record<string, DraftMode>;
  defaultStrategy: Strategy;
  riskTolerance: number;
  researchDepth: "quick" | "standard" | "deep";
  automaticAnalysis: boolean;
  maxRequestsPerMinute: number;
  maxConcurrency: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  routineModel: string;
  researchModel: string;
  manualModelIds: string[];
  enablePublicData: boolean;
  theme: Theme;
  reducedMotion: boolean;
  highContrast: boolean;
  launcherEnabled: boolean;
  launcherPosition: "bottom_left" | "bottom_right";
  logLevel: "debug" | "info" | "warning" | "error";
};

export type UsageEvent = {
  id: string;
  timestamp: number;
  feature: string;
  model?: string;
  status: "success" | "failure" | "cache_hit" | "cache_miss";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  diagnosticCode?: string;
};

export type ModelCapability = {
  id: string;
  structuredOutput: boolean | "unknown";
  webSearch: boolean | "unknown";
  reasoning: boolean | "unknown";
  priceClass: "low" | "standard" | "high" | "unknown";
};
