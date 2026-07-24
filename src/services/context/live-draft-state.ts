import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperUser,
} from "@/schemas/sleeper";
import {
  detectDraftMode,
  detectLeagueFormat,
} from "@/services/ranking/mode-detection";
import type {
  AppSettings,
  DraftContext,
  DraftPick,
  LiveDraftState,
  Player,
  Position,
} from "@/types/domain";

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
  settings: AppSettings;
  routeUrl?: string;
  league?: SleeperLeague | null;
  users?: SleeperUser[];
  rosters?: SleeperRoster[];
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
    positiveInteger(input.league?.total_rosters) ??
    positiveInteger(draftSettings["teams"]) ??
    positiveInteger(draftSettings["num_teams"]) ??
    objectSize(input.draft.draft_order) ??
    objectSize(input.draft.slot_to_roster_id) ??
    12;
  const rounds =
    positiveInteger(draftSettings["rounds"]) ??
    Math.max(1, Math.ceil(input.picks.length / teams));
  const rosterPositions = input.league?.roster_positions.length
    ? input.league.roster_positions
    : rosterPositionsFromDraftSettings(draftSettings);
  const leagueType = finiteNumber(leagueSettings["type"]);
  const playerPool = playerPoolSignals(input.draft);
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
  const picks = input.picks
    .toSorted((a, b) => a.pick_no - b.pick_no)
    .map((pick) =>
      normalizePick(pick, playerById, userNames, userId, userRoster),
    );
  const currentPick = nextPickNumber(picks, input.draft.status);
  const userSlot =
    userId && input.draft.draft_order
      ? input.draft.draft_order[userId]
      : undefined;
  const nextUserPick =
    userSlot === undefined
      ? undefined
      : findNextOwnedPick(currentPick, teams, rounds, userSlot);
  const currentSlot = slotForPick(currentPick, teams);
  const currentDrafterId = userAtSlot(input.draft.draft_order, currentSlot);
  const status = normalizeDraftStatus(input.draft.status);
  const leagueId = resolveDraftLeagueId(input.draft);
  const rosterId =
    userRoster?.roster_id ??
    (userSlot === undefined
      ? undefined
      : input.draft.slot_to_roster_id?.[String(userSlot)]);
  const context: DraftContext = {
    supported: true,
    source: "sleeper",
    ...(input.routeUrl ? { url: input.routeUrl } : {}),
    ...(userId ? { userId } : {}),
    ...(input.settings.sleeperUsername || userNames.get(userId)
      ? { username: input.settings.sleeperUsername || userNames.get(userId) }
      : {}),
    ...(leagueId ? { leagueId } : {}),
    leagueName:
      input.league?.name ??
      stringValue(input.draft.metadata["name"]) ??
      "Sleeper mock draft",
    draftId: input.draft.draft_id,
    draftName:
      stringValue(input.draft.metadata["name"]) ??
      (input.draft.league_id ? "League draft" : "Mock draft"),
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
    ...(finiteNumber(draftSettings["pick_timer"]) === undefined
      ? {}
      : { secondsRemaining: finiteNumber(draftSettings["pick_timer"]) }),
    status,
    lastUpdatedAt: now,
    connected: true,
  };
  const pickedIds = new Set(picks.map((pick) => pick.playerId));

  return {
    context,
    format,
    picks,
    players: input.players.filter((player) => !pickedIds.has(player.id)),
    fetchedAt: now,
    playerIndexStale: input.playerIndexStale ?? false,
  };
}

function normalizePick(
  pick: SleeperDraftPick,
  playerById: Map<string, Player>,
  userNames: Map<string, string>,
  userId: string,
  userRoster?: SleeperRoster,
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
      Boolean(
        userRoster &&
        pick.roster_id !== null &&
        pick.roster_id === userRoster.roster_id,
      ),
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

function slotForPick(pickNumber: number, teams: number): number {
  const round = Math.max(1, Math.ceil(pickNumber / teams));
  const inRound = ((Math.max(1, pickNumber) - 1) % teams) + 1;
  return round % 2 === 0 ? teams - inRound + 1 : inRound;
}

function findNextOwnedPick(
  currentPick: number,
  teams: number,
  rounds: number,
  userSlot: number,
): number | undefined {
  const maximum = teams * rounds;
  for (let pick = currentPick; pick <= maximum; pick += 1) {
    if (slotForPick(pick, teams) === userSlot) return pick;
  }
  return undefined;
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
    Array.from({ length: positiveInteger(settings[key]) ?? 0 }, () => position),
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

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number >= 1 ? Math.floor(number) : undefined;
}

function objectSize(
  value: Record<string, unknown> | null | undefined,
): number | undefined {
  const size = Object.keys(value ?? {}).length;
  return size > 0 ? size : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
