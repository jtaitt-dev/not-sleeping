import { detectSleeperCapabilities } from "@/config/sleeper-capabilities";
import type {
  SleeperDraft,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperTradedPick,
} from "@/schemas/sleeper";
import {
  isAscendingRound,
  type DraftEngineConfig,
} from "@/services/draft/draft-engine";
import type { DraftStyle } from "@/types/league";

export type PickOwnershipRecord = {
  pickNumber: number;
  season: string;
  round: number;
  originalRosterId: number;
  currentRosterId: number;
  previousRosterId: number;
  originalDraftSlot: number | null;
  currentOwnerSlot: number | null;
};

export type LeagueMockDraftPlan = {
  config: DraftEngineConfig;
  leagueId: string;
  leagueName: string;
  season: string;
  draftId: string | null;
  draftStatus: string;
  source: "verified_sleeper";
  draftOrderAssigned: boolean;
  userSlotSource: "sleeper_draft_order" | "local_choice_required";
  teamLabelsBySlot: Record<number, string>;
  pickOwnership: PickOwnershipRecord[];
  warnings: string[];
};

export function buildLeagueMockDraftPlan(input: {
  league: SleeperLeague;
  draft?: SleeperDraft | null;
  rosters: SleeperRoster[];
  users: SleeperLeagueUser[];
  tradedPicks: SleeperTradedPick[];
  userId: string;
  userSlotOverride?: number;
}): LeagueMockDraftPlan {
  const capabilities = detectSleeperCapabilities(input.league, input.draft);
  const teams = integerSetting(
    input.draft?.settings,
    "teams",
    input.league.total_rosters ?? input.rosters.length,
    64,
  );
  const rounds = integerSetting(
    input.draft?.settings,
    "rounds",
    integerSetting(
      input.league.settings,
      "draft_rounds",
      input.league.roster_positions.length,
      80,
    ),
    80,
  );
  const detectedStyle = capabilities.draftStyle ?? "unknown";
  const style: DraftStyle =
    detectedStyle === "unknown" ? "snake" : detectedStyle;
  const rosterToSlot = resolveRosterSlots(input.draft, input.rosters, teams);
  const assignedUserSlot = input.draft?.draft_order?.[input.userId];
  const override = boundedSlot(input.userSlotOverride, teams);
  const userSlot = boundedSlot(assignedUserSlot, teams) ?? override ?? 1;
  const draftOrderAssigned =
    Object.keys(input.draft?.draft_order ?? {}).length === teams &&
    rosterToSlot.size === teams;
  const warnings: string[] = [];
  if (!draftOrderAssigned) {
    warnings.push(
      "Sleeper has not assigned the complete draft order. Choose a local slot; it is used only inside this simulation.",
    );
  }

  const ownership = resolveTradedPickOwnership({
    tradedPicks: input.tradedPicks,
    rosterToSlot,
    season: input.league.season,
    teams,
    rounds,
    style,
  });
  const unresolvedTrades = ownership.filter(
    (pick) => pick.originalDraftSlot === null || pick.currentOwnerSlot === null,
  ).length;
  if (unresolvedTrades > 0) {
    warnings.push(
      `${unresolvedTrades} traded pick${unresolvedTrades === 1 ? "" : "s"} cannot be placed until Sleeper assigns every draft slot. Ownership is shown but not guessed.`,
    );
  }

  const tradedPickOwners = Object.fromEntries(
    ownership.flatMap((pick) =>
      pick.pickNumber > 0 && pick.currentOwnerSlot !== null
        ? [[pick.pickNumber, pick.currentOwnerSlot]]
        : [],
    ),
  );
  const unavailablePlayerIds =
    capabilities.leagueType === "dynasty" ||
    capabilities.playerPool === "rookies_only" ||
    capabilities.draftPurpose === "supplemental"
      ? [
          ...new Set(
            input.rosters.flatMap((roster) => [
              ...(roster.players ?? []),
              ...(roster.reserve ?? []),
              ...(roster.taxi ?? []),
            ]),
          ),
        ]
      : [];

  return {
    config: {
      seed: stableSeed(
        `${input.league.league_id}:${input.draft?.draft_id ?? "local"}`,
      ),
      leagueType: capabilities.leagueType,
      teams,
      rounds,
      style,
      playerPool:
        capabilities.playerPool && capabilities.playerPool !== "unknown"
          ? capabilities.playerPool
          : "all_available",
      rosterSlots: input.league.roster_positions,
      userSlot,
      opponentArchetypes: [
        "adp_follower",
        "positional_need",
        "best_player_available",
        ...(capabilities.leagueType === "dynasty"
          ? (["dynasty_youth", "dynasty_contender"] as const)
          : []),
        ...(capabilities.idp ? (["idp_early"] as const) : []),
        "random_within_tier",
      ],
      tradedPickOwners,
      manualAllTeams: true,
      superflex: capabilities.superflex,
      tePremium: capabilities.tightEndPremium,
      idp: capabilities.idp,
      bestBall: capabilities.lineupType === "best_ball",
      unavailablePlayerIds,
      positionLimits: extractPositionLimits(input.league.settings),
      recordHistory: true,
    },
    leagueId: input.league.league_id,
    leagueName: input.league.name,
    season: input.league.season,
    draftId: input.draft?.draft_id ?? null,
    draftStatus: input.draft?.status ?? "unavailable",
    source: "verified_sleeper",
    draftOrderAssigned,
    userSlotSource: assignedUserSlot
      ? "sleeper_draft_order"
      : "local_choice_required",
    teamLabelsBySlot: resolveTeamLabels(
      rosterToSlot,
      input.rosters,
      input.users,
    ),
    pickOwnership: ownership,
    warnings,
  };
}

function resolveRosterSlots(
  draft: SleeperDraft | null | undefined,
  rosters: SleeperRoster[],
  teams: number,
): Map<number, number> {
  const result = new Map<number, number>();
  for (const [slotValue, rosterId] of Object.entries(
    draft?.slot_to_roster_id ?? {},
  )) {
    const slot = boundedSlot(Number(slotValue), teams);
    if (slot) result.set(rosterId, slot);
  }
  for (const roster of rosters) {
    const managerIds = [roster.owner_id, ...(roster.co_owners ?? [])].filter(
      (value): value is string => Boolean(value),
    );
    const slot = managerIds
      .map((userId) => boundedSlot(draft?.draft_order?.[userId], teams))
      .find((value): value is number => value !== null);
    if (slot) result.set(roster.roster_id, slot);
  }
  return result;
}

function resolveTradedPickOwnership(input: {
  tradedPicks: SleeperTradedPick[];
  rosterToSlot: Map<number, number>;
  season: string;
  teams: number;
  rounds: number;
  style: DraftStyle;
}): PickOwnershipRecord[] {
  const byOriginalPick = new Map<string, SleeperTradedPick>();
  for (const pick of input.tradedPicks) {
    if (pick.season !== input.season || pick.round > input.rounds) continue;
    byOriginalPick.set(`${pick.season}:${pick.round}:${pick.roster_id}`, pick);
  }
  return [...byOriginalPick.values()]
    .map((pick) => {
      const originalDraftSlot = input.rosterToSlot.get(pick.roster_id) ?? null;
      const currentOwnerSlot = input.rosterToSlot.get(pick.owner_id) ?? null;
      return {
        pickNumber:
          originalDraftSlot === null
            ? 0
            : pickNumberForDraftSlot(
                input.style,
                input.teams,
                pick.round,
                originalDraftSlot,
              ),
        season: pick.season,
        round: pick.round,
        originalRosterId: pick.roster_id,
        currentRosterId: pick.owner_id,
        previousRosterId: pick.previous_owner_id,
        originalDraftSlot,
        currentOwnerSlot,
      };
    })
    .toSorted(
      (left, right) =>
        left.round - right.round ||
        left.originalRosterId - right.originalRosterId,
    );
}

export function pickNumberForDraftSlot(
  style: DraftStyle,
  teams: number,
  round: number,
  draftSlot: number,
): number {
  const ascending = isAscendingRound(style, round);
  const pickInRound = ascending ? draftSlot : teams - draftSlot + 1;
  return (round - 1) * teams + pickInRound;
}

function resolveTeamLabels(
  rosterToSlot: Map<number, number>,
  rosters: SleeperRoster[],
  users: SleeperLeagueUser[],
): Record<number, string> {
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  return Object.fromEntries(
    rosters.flatMap((roster) => {
      const slot = rosterToSlot.get(roster.roster_id);
      if (!slot) return [];
      const user = roster.owner_id ? usersById.get(roster.owner_id) : null;
      const metadata = user?.metadata ?? {};
      const teamName =
        typeof metadata["team_name"] === "string"
          ? metadata["team_name"]
          : (user?.display_name ??
            user?.username ??
            `Roster ${roster.roster_id}`);
      return [[slot, teamName]];
    }),
  );
}

function boundedSlot(
  value: number | null | undefined,
  teams: number,
): number | null {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= teams
    ? Number(value)
    : null;
}

function integerSetting(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
  maximum: number,
): number {
  const value = Number(settings?.[key]);
  const resolved =
    Number.isInteger(value) && value > 0 ? value : Math.max(1, fallback);
  return Math.min(maximum, resolved);
}

function stableSeed(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 0x01000193);
  }
  return result >>> 0;
}

function extractPositionLimits(
  settings: Record<string, unknown>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(settings).flatMap(([key, raw]) => {
      if (!key.startsWith("position_limit_")) return [];
      const value = Number(raw);
      if (!Number.isInteger(value) || value <= 0) return [];
      return [
        [
          key.slice("position_limit_".length).toUpperCase(),
          Math.min(160, value),
        ],
      ];
    }),
  );
}
