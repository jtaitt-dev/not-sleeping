import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperProjection,
  SleeperTradedPick,
  SleeperUser,
} from "@/schemas/sleeper";
import {
  detectDraftMode,
  detectLeagueFormat,
} from "@/services/ranking/mode-detection";
import type {
  AppSettings,
  DraftContext,
  DraftSessionKind,
  DraftPick,
  LiveDraftState,
  Player,
  Position,
} from "@/types/domain";
import {
  draftSlotForPick,
  nextOwnedPick,
  ownedDraftPicks,
} from "@/services/draft/draft-order";
import { detectDraftSession } from "@/services/draft/session-detection";
import { detectPlayerPool } from "@/config/sleeper-capabilities";
import { resolveRookieEligibility } from "@/services/ranking/rookie-eligibility";

const POSITIONS = new Set<Position>([
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DEF",
  "DL",
  "LB",
  "DB",
]);

type BuildLiveDraftStateInput = {
  draft: SleeperDraft;
  picks: SleeperDraftPick[];
  players: Player[];
  projections?: SleeperProjection[];
  settings: AppSettings;
  routeUrl?: string;
  league?: SleeperLeague | null;
  users?: SleeperUser[];
  rosters?: SleeperRoster[];
  tradedPicks?: SleeperTradedPick[];
  sessionKindOverride?: DraftSessionKind;
  playerIndexStale?: boolean;
  now?: number;
};

export function buildLiveDraftState(
  input: BuildLiveDraftStateInput,
): LiveDraftState {
  const now = input.now ?? Date.now();
  const draftSettings = input.draft.settings;
  const leagueSettings = input.league?.settings ?? {};
  const teams =
    positiveInteger(input.league?.total_rosters, 64) ??
    positiveInteger(draftSettings["teams"], 64) ??
    positiveInteger(draftSettings["num_teams"], 64) ??
    objectSize(input.draft.draft_order, 64) ??
    objectSize(input.draft.slot_to_roster_id, 64) ??
    12;
  const rounds =
    positiveInteger(draftSettings["rounds"], 80) ??
    Math.max(1, Math.ceil(input.picks.length / teams));
  const rosterPositions = input.league?.roster_positions.length
    ? input.league.roster_positions
    : rosterPositionsFromDraftSettings(draftSettings);
  const leagueType = finiteNumber(leagueSettings["type"]);
  const playerPool = playerPoolSignals(input.draft);
  const playerPoolKind = detectPlayerPool(input.draft);
  const detectionInput = {
    ...(leagueType === undefined ? {} : { leagueType }),
    leagueSettings: {
      ...leagueSettings,
      ...draftSettings,
      num_teams: teams,
    },
    scoringSettings: input.league?.scoring_settings ?? {},
    rosterPositions,
    draftType: input.draft.type,
    draftStatus: input.draft.status,
    draftRounds: rounds,
    playerPool,
    keepers: input.picks
      .filter((pick) => pick.is_keeper)
      .map((pick) => pick.player_id),
    taxiSlots: rosterPositions.filter((position) => position === "TAXI").length,
    existingOwnedPlayerCount: (input.rosters ?? []).reduce(
      (total, roster) => total + (roster.players?.length ?? 0),
      0,
    ),
    ...(input.settings.defaultMode === "unknown"
      ? {}
      : { manualOverride: input.settings.defaultMode }),
  };
  const mode = detectDraftMode(detectionInput);
  const format = {
    ...detectLeagueFormat(detectionInput),
    teams,
    draftRounds: rounds,
  };
  const playerById = new Map(
    input.players.map((player) => [player.id, player]),
  );
  const userNames = new Map(
    (input.users ?? []).map((user) => [
      user.user_id,
      user.display_name ?? user.username ?? `Manager ${user.user_id.slice(-4)}`,
    ]),
  );
  const userId = resolveDraftUserId(input.settings, input.draft);
  const userRoster = input.rosters?.find(
    (roster) => roster.owner_id === userId,
  );
  const userRosterPlayerIds = new Set([
    ...(userRoster?.players ?? []),
    ...(userRoster?.starters ?? []),
    ...(userRoster?.reserve ?? []),
    ...(userRoster?.taxi ?? []),
  ]);
  const allRosteredPlayerIds = new Set(
    (input.rosters ?? []).flatMap((roster) => [
      ...(roster.players ?? []),
      ...(roster.starters ?? []),
      ...(roster.reserve ?? []),
      ...(roster.taxi ?? []),
    ]),
  );
  const unavailableRosteredPlayerIds =
    leagueType === 2 || playerPoolKind === "rookies_only"
      ? allRosteredPlayerIds
      : new Set<string>();
  const rosterPlayers = [...userRosterPlayerIds].flatMap((playerId) => {
    const player = playerById.get(playerId);
    return player ? [player] : [];
  });
  const userSlot = userId ? input.draft.draft_order?.[userId] : undefined;
  const draftRosterId =
    (userSlot === undefined
      ? undefined
      : input.draft.slot_to_roster_id?.[String(userSlot)]) ??
    userRoster?.roster_id;
  const picks = input.picks
    .toSorted((a, b) => a.pick_no - b.pick_no)
    .map((pick) =>
      normalizePick(pick, playerById, userNames, userId, draftRosterId),
    );
  const currentPick = nextPickNumber(picks, input.draft.status);
  const ownership = ownedDraftPicks({
    draft: input.draft,
    tradedPicks: input.tradedPicks,
    teams,
    rounds,
    ...(userId ? { userId } : {}),
    ...(draftRosterId === undefined ? {} : { rosterId: draftRosterId }),
  });
  const nextUserPick = nextOwnedPick(ownership.picks, currentPick);
  const currentSlot = draftSlotForPick(currentPick, teams, ownership.style);
  const currentDrafterId = userAtSlot(input.draft.draft_order, currentSlot);
  const status = normalizeDraftStatus(input.draft.status);
  const leagueId = resolveDraftLeagueId(input.draft);
  const session = detectDraftSession({
    draft: input.draft,
    ...(input.routeUrl ? { routeUrl: input.routeUrl } : {}),
    ...(input.sessionKindOverride
      ? { override: input.sessionKindOverride }
      : {}),
  });
  const rosterId = draftRosterId;
  const auction =
    ownership.style === "auction"
      ? buildAuctionContext(
          draftSettings,
          input.draft.metadata,
          picks,
          rosterPositions,
          rounds,
        )
      : undefined;
  const context: DraftContext = {
    supported: true,
    source: "sleeper",
    ...(positiveInteger(Number(input.draft.season), 3_000)
      ? { season: positiveInteger(Number(input.draft.season), 3_000) }
      : {}),
    ...(input.routeUrl ? { url: input.routeUrl } : {}),
    ...(userId ? { userId } : {}),
    ...(input.settings.sleeperUsername || userNames.get(userId)
      ? { username: input.settings.sleeperUsername || userNames.get(userId) }
      : {}),
    ...(leagueId ? { leagueId } : {}),
    ...(session.sourceLeagueId
      ? { sourceLeagueId: session.sourceLeagueId }
      : {}),
    leagueName:
      input.league?.name ??
      stringValue(input.draft.metadata["name"]) ??
      "Sleeper mock draft",
    draftId: input.draft.draft_id,
    draftName:
      stringValue(input.draft.metadata["name"]) ??
      (input.draft.league_id ? "League draft" : "Mock draft"),
    sessionKind: session.kind,
    sessionKindConfidence: session.confidence,
    sessionKindEvidence: session.evidence,
    sessionKindOverride: session.overridden,
    draftStyle: ownership.style,
    ...(auction ? { auction } : {}),
    ...(rosterId === undefined ? {} : { rosterId: String(rosterId) }),
    mode: mode.mode,
    modeConfidence: mode.confidence,
    modeEvidence: mode.evidence,
    currentPick,
    currentRound: Math.max(1, Math.ceil(currentPick / teams)),
    ...(currentDrafterId
      ? {
          currentDrafter:
            userNames.get(currentDrafterId) ??
            (currentDrafterId === userId
              ? input.settings.sleeperUsername || "You"
              : `Draft slot ${currentSlot}`),
        }
      : status === "pre_draft"
        ? { currentDrafter: "Waiting to start" }
        : {}),
    ...(nextUserPick === undefined
      ? {}
      : {
          nextUserPick,
          picksUntilUser: Math.max(0, nextUserPick - currentPick),
        }),
    ownedPickNumbers: ownership.picks,
    isUserOnClock: ownership.picks.includes(currentPick),
    ...(finiteNumber(draftSettings["pick_timer"]) === undefined
      ? {}
      : { secondsRemaining: finiteNumber(draftSettings["pick_timer"]) }),
    status,
    lastUpdatedAt: now,
    connected: true,
  };
  const pickedIds = new Set(picks.map((pick) => pick.playerId));
  const playerValues = buildPlayerValues(input.projections ?? [], format);

  return {
    context,
    format,
    picks,
    players: filterPlayerPool(
      input.players.filter(
        (player) =>
          !pickedIds.has(player.id) &&
          !unavailableRosteredPlayerIds.has(player.id),
      ),
      playerPoolKind,
      Number(input.draft.season),
    ),
    ...(rosterPlayers.length > 0 ? { rosterPlayers } : {}),
    ...(Object.keys(playerValues).length > 0 ? { playerValues } : {}),
    fetchedAt: now,
    playerIndexStale: input.playerIndexStale ?? false,
  };
}

function buildPlayerValues(
  projections: SleeperProjection[],
  format: LiveDraftState["format"],
): NonNullable<LiveDraftState["playerValues"]> {
  const scoringSuffix =
    format.scoring === "ppr"
      ? "ppr"
      : format.scoring === "half_ppr"
        ? "half_ppr"
        : "std";
  const dynasty = ["dynasty_startup", "dynasty_rookie"].includes(format.mode);
  const adpKeys =
    format.superflex || format.twoQuarterback
      ? dynasty
        ? ["adp_dynasty_2qb", "adp_2qb"]
        : ["adp_2qb"]
      : dynasty
        ? [`adp_dynasty_${scoringSuffix}`, "adp_dynasty"]
        : [`adp_${scoringSuffix}`, "adp_std"];
  const pointsKeys = [`pts_${scoringSuffix}`, "pts_std"];
  return Object.fromEntries(
    projections.flatMap((row) => {
      const adp = firstFinite(row.stats, adpKeys);
      const projectedPoints = firstFinite(row.stats, pointsKeys);
      if (adp === undefined && projectedPoints === undefined) return [];
      return [
        [
          row.player_id,
          {
            ...(adp === undefined ? {} : { adp }),
            ...(projectedPoints === undefined ? {} : { projectedPoints }),
          },
        ],
      ];
    }),
  );
}

function firstFinite(
  values: Record<string, number | null>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = values[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function normalizePick(
  pick: SleeperDraftPick,
  playerById: Map<string, Player>,
  userNames: Map<string, string>,
  userId: string,
  userRosterId?: number,
): DraftPick {
  const player = playerById.get(pick.player_id);
  const position =
    player?.position ?? normalizePosition(pick.metadata["position"]);
  const metadataName = [
    stringValue(pick.metadata["first_name"]),
    stringValue(pick.metadata["last_name"]),
  ]
    .filter(Boolean)
    .join(" ");
  const safeMetadataName = metadataName ? metadataName : undefined;
  const price = firstNumericValue(pick.metadata, [
    "amount",
    "price",
    "bid_amount",
  ]);
  return {
    pickNumber: pick.pick_no,
    round: pick.round,
    pickInRound: pick.draft_slot,
    playerId: pick.player_id,
    playerName:
      player?.fullName ??
      safeMetadataName ??
      stringValue(pick.metadata["full_name"]) ??
      `Player ${pick.player_id}`,
    position,
    ...(player?.team || stringValue(pick.metadata["team"])
      ? { team: player?.team ?? stringValue(pick.metadata["team"]) }
      : {}),
    ...(pick.roster_id === null || pick.roster_id === undefined
      ? {}
      : { rosterId: String(pick.roster_id) }),
    ...(pick.picked_by
      ? {
          pickedBy:
            userNames.get(pick.picked_by) ??
            (pick.picked_by === userId
              ? "You"
              : `Draft slot ${pick.draft_slot}`),
        }
      : {}),
    isKeeper: Boolean(pick.is_keeper),
    isUserPick:
      Boolean(userId && pick.picked_by === userId) ||
      (userRosterId !== undefined &&
        pick.roster_id !== null &&
        pick.roster_id === userRosterId),
    ...(price === undefined ? {} : { price }),
  };
}

function buildAuctionContext(
  settings: Record<string, unknown>,
  metadata: Record<string, unknown>,
  picks: DraftPick[],
  rosterPositions: string[],
  rounds: number,
): NonNullable<DraftContext["auction"]> {
  const initialBudget =
    firstNumericValue(settings, ["auction_budget", "budget"]) ?? 200;
  const minimumBid =
    firstNumericValue(settings, [
      "auction_min_bid",
      "minimum_bid",
      "min_bid",
    ]) ?? 1;
  const rosterSpots = Math.max(
    1,
    rosterPositions.filter(
      (position) => !["TAXI", "IR", "RESERVE"].includes(position),
    ).length || rounds,
  );
  const userPicks = picks.filter((pick) => pick.isUserPick);
  const spent = userPicks.reduce((total, pick) => total + (pick.price ?? 0), 0);
  const currentBid = firstNumericValue(metadata, ["current_bid", "bid"]);
  const bidLeader = stringValue(metadata["bid_leader"]);
  const currentNominationPlayerId =
    stringValue(metadata["nomination_player_id"]) ??
    stringValue(metadata["player_id"]);
  return {
    initialBudget,
    remainingBudget: Math.max(0, initialBudget - spent),
    minimumBid,
    rosterSpots,
    filledSpots: userPicks.length,
    ...(currentBid === undefined ? {} : { currentBid }),
    ...(bidLeader ? { bidLeader } : {}),
    ...(currentNominationPlayerId ? { currentNominationPlayerId } : {}),
  };
}

function normalizePosition(value: unknown): Position {
  const normalized =
    typeof value === "string" ? (value.toUpperCase() as Position) : "FLEX";
  return POSITIONS.has(normalized) ? normalized : "FLEX";
}

function normalizeDraftStatus(status: string): DraftContext["status"] {
  switch (status.toLowerCase()) {
    case "pre_draft":
      return "pre_draft";
    case "drafting":
    case "in_progress":
      return "drafting";
    case "paused":
      return "paused";
    case "complete":
    case "completed":
      return "complete";
    default:
      return "unknown";
  }
}

function nextPickNumber(picks: DraftPick[], status: string): number {
  const last = picks.at(-1)?.pickNumber ?? 0;
  return /complete/i.test(status) ? Math.max(1, last) : last + 1;
}

function userAtSlot(
  draftOrder: Record<string, number> | null | undefined,
  slot: number,
): string | undefined {
  return Object.entries(draftOrder ?? {}).find(
    ([, draftSlot]) => draftSlot === slot,
  )?.[0];
}

function rosterPositionsFromDraftSettings(
  settings: Record<string, unknown>,
): string[] {
  const mapping: Array<[string, string]> = [
    ["slots_qb", "QB"],
    ["slots_rb", "RB"],
    ["slots_wr", "WR"],
    ["slots_te", "TE"],
    ["slots_flex", "FLEX"],
    ["slots_super_flex", "SUPER_FLEX"],
    ["slots_dl", "DL"],
    ["slots_lb", "LB"],
    ["slots_db", "DB"],
    ["slots_idp_flex", "IDP_FLEX"],
    ["slots_k", "K"],
    ["slots_def", "DEF"],
    ["slots_bn", "BN"],
  ];
  return mapping.flatMap(([key, position]) =>
    Array.from(
      { length: positiveInteger(settings[key], 80) ?? 0 },
      () => position,
    ),
  );
}

export function resolveDraftLeagueId(draft: SleeperDraft): string | undefined {
  return draft.league_id ?? stringValue(draft.metadata["league_id"]);
}

function resolveDraftUserId(
  settings: AppSettings,
  draft: SleeperDraft,
): string {
  if (settings.sleeperUserId) return settings.sleeperUserId;
  const managers = Object.keys(draft.draft_order ?? {});
  return managers.length === 1 ? (managers[0] ?? "") : "";
}

function playerPoolSignals(draft: SleeperDraft): string[] {
  const detected = detectPlayerPool(draft);
  if (detected === "rookies_only") return ["rookies"];
  if (detected === "veterans_only") return ["veterans"];
  if (detected === "all_available") return ["rookies", "veterans"];
  const raw = [
    stringValue(draft.metadata["player_type"]),
    stringValue(draft.metadata["player_pool"]),
    stringValue(draft.settings["player_type"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const signals: string[] = [];
  if (raw.includes("rook")) signals.push("rookies");
  if (raw.includes("vet") || !raw.includes("rook")) signals.push("veterans");
  return signals;
}

function filterPlayerPool(
  players: Player[],
  pool: ReturnType<typeof detectPlayerPool>,
  season: number,
): Player[] {
  if (pool === "rookies_only") {
    return players.filter(
      (player) => resolveRookieEligibility(player, season).eligible,
    );
  }
  if (pool === "veterans_only") {
    return players.filter(
      (player) => !resolveRookieEligibility(player, season).eligible,
    );
  }
  return players;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function positiveInteger(value: unknown, maximum: number): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number >= 1 && number <= maximum
    ? Math.floor(number)
    : undefined;
}

function objectSize(
  value: Record<string, unknown> | null | undefined,
  maximum: number,
): number | undefined {
  const size = Object.keys(value ?? {}).length;
  return size > 0 && size <= maximum ? size : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstNumericValue(
  record: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}
