import type { SleeperRoster, SleeperTradedPick } from "@/schemas/sleeper";
import { optimizeLineup } from "@/services/lineup/lineup-optimizer";
import { calculateFantasyScore } from "@/services/scoring/scoring-engine";
import {
  analyzeTrade,
  type TradeAnalysis,
  type TradeAsset,
} from "@/services/trades/trade-service";
import type { LeagueSnapshot } from "@/stores/league-store";
import type { Player } from "@/types/domain";
import type { LeagueContext } from "@/types/league";

export type TradeCenterAsset = {
  id: string;
  kind: "player" | "pick";
  ownerRosterId: number;
  label: string;
  detail: string;
  sourceLabel: string;
  player: Player | null;
  tradeAsset: TradeAsset;
};

export type TradeCenterParty = {
  rosterId: number;
  teamName: string;
  ownerName: string;
  avatarUrl: string | null;
  assets: TradeCenterAsset[];
  playerCount: number;
  totalCapacity: number;
  openSpots: number;
  projectedStarterPoints: number;
  leagueScoredPlayerCount: number;
  importedProjectionPlayerCount: number;
};

export type TradeCenterView = {
  leagueId: string;
  user: TradeCenterParty;
  partners: TradeCenterParty[];
  selectedPartner: TradeCenterParty;
  projectionCoverageLabel: string;
};

export type TradeScenario = {
  analysis: TradeAnalysis;
  sends: TradeCenterAsset[];
  receives: TradeCenterAsset[];
  userBefore: number;
  userAfter: number;
  partnerBefore: number;
  partnerAfter: number;
  userOpenSpotsAfter: number;
  partnerOpenSpotsAfter: number;
};

type ProjectionResult = {
  weeklyPoints: number;
  source: "league_scored" | "imported" | "proxy";
};

export function buildTradeCenterView(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  selectedPartnerRosterId: number | null,
): TradeCenterView | null {
  if (
    context.leagueId !== snapshot.leagueId ||
    context.leagueId !== snapshot.league.league_id ||
    context.userId !== snapshot.userId ||
    context.rosterId === null
  ) {
    return null;
  }
  const userRoster = snapshot.rosters.find(
    (roster) => roster.roster_id === context.rosterId,
  );
  if (!userRoster) return null;
  const futurePicks = reconstructFuturePicks(context, snapshot);
  const user = buildParty(context, snapshot, userRoster, futurePicks);
  const partners = snapshot.rosters
    .filter(
      (roster) =>
        roster.roster_id !== context.rosterId && Boolean(roster.owner_id),
    )
    .map((roster) => buildParty(context, snapshot, roster, futurePicks))
    .toSorted(
      (left, right) =>
        left.teamName.localeCompare(right.teamName) ||
        left.rosterId - right.rosterId,
    );
  const selectedPartner =
    partners.find((party) => party.rosterId === selectedPartnerRosterId) ??
    partners[0];
  if (!selectedPartner) return null;
  const leagueScored = [user, ...partners].reduce(
    (sum, party) => sum + party.leagueScoredPlayerCount,
    0,
  );
  const imported = [user, ...partners].reduce(
    (sum, party) => sum + party.importedProjectionPlayerCount,
    0,
  );
  const players = [user, ...partners].reduce(
    (sum, party) => sum + party.playerCount,
    0,
  );
  return {
    leagueId: context.leagueId,
    user,
    partners,
    selectedPartner,
    projectionCoverageLabel:
      players === 0
        ? "No rostered players"
        : `${leagueScored} league-scored · ${imported} imported fallback · ${players - leagueScored - imported} rank proxy across ${players} rostered players`,
  };
}

export function buildTradeScenario(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  selectedPartnerRosterId: number | null,
  sendIds: string[],
  receiveIds: string[],
): TradeScenario | null {
  const view = buildTradeCenterView(context, snapshot, selectedPartnerRosterId);
  if (!view) return null;
  const sendSet = new Set(sendIds);
  const receiveSet = new Set(receiveIds);
  const sends = view.user.assets.filter((asset) => sendSet.has(asset.id));
  const receives = view.selectedPartner.assets.filter((asset) =>
    receiveSet.has(asset.id),
  );
  const userRoster = snapshot.rosters.find(
    (roster) => roster.roster_id === view.user.rosterId,
  );
  const partnerRoster = snapshot.rosters.find(
    (roster) => roster.roster_id === view.selectedPartner.rosterId,
  );
  if (!userRoster || !partnerRoster) return null;
  const playerById = new Map(
    snapshot.players.map((player) => [player.id, player]),
  );
  const userPlayers = rosterPlayers(userRoster, playerById);
  const partnerPlayers = rosterPlayers(partnerRoster, playerById);
  const sentPlayerIds = new Set(
    sends.flatMap((asset) => (asset.player ? [asset.player.id] : [])),
  );
  const receivedPlayerIds = new Set(
    receives.flatMap((asset) => (asset.player ? [asset.player.id] : [])),
  );
  const userAfterPlayers = [
    ...userPlayers.filter((player) => !sentPlayerIds.has(player.id)),
    ...receives.flatMap((asset) => (asset.player ? [asset.player] : [])),
  ];
  const partnerAfterPlayers = [
    ...partnerPlayers.filter((player) => !receivedPlayerIds.has(player.id)),
    ...sends.flatMap((asset) => (asset.player ? [asset.player] : [])),
  ];
  const userAfter = projectLineup(
    context,
    snapshot,
    userRoster,
    userAfterPlayers,
    receivedPlayerIds,
  ).points;
  const partnerAfter = projectLineup(
    context,
    snapshot,
    partnerRoster,
    partnerAfterPlayers,
    sentPlayerIds,
  ).points;
  const userOpenSpotsAfter = view.user.totalCapacity - userAfterPlayers.length;
  const partnerOpenSpotsAfter =
    view.selectedPartner.totalCapacity - partnerAfterPlayers.length;
  const analysis = analyzeTrade({
    context,
    parties: [
      {
        rosterId: view.user.rosterId,
        teamName: view.user.teamName,
        sends: sends.map((asset) => asset.tradeAsset),
        receives: receives.map((asset) => asset.tradeAsset),
        beforeStarterPoints: view.user.projectedStarterPoints,
        afterStarterPoints: userAfter,
        beforeDepth: view.user.playerCount,
        afterDepth: userAfterPlayers.length,
        rosterSpotsAfter: userOpenSpotsAfter,
      },
      {
        rosterId: view.selectedPartner.rosterId,
        teamName: view.selectedPartner.teamName,
        sends: receives.map((asset) => asset.tradeAsset),
        receives: sends.map((asset) => asset.tradeAsset),
        beforeStarterPoints: view.selectedPartner.projectedStarterPoints,
        afterStarterPoints: partnerAfter,
        beforeDepth: view.selectedPartner.playerCount,
        afterDepth: partnerAfterPlayers.length,
        rosterSpotsAfter: partnerOpenSpotsAfter,
      },
    ],
    positionalScarcity: {
      QB: context.rosterPositions.includes("SUPER_FLEX") ? 0.9 : 0.3,
      TE: 0.45,
    },
  });
  return {
    analysis,
    sends,
    receives,
    userBefore: view.user.projectedStarterPoints,
    userAfter,
    partnerBefore: view.selectedPartner.projectedStarterPoints,
    partnerAfter,
    userOpenSpotsAfter,
    partnerOpenSpotsAfter,
  };
}

function buildParty(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  roster: SleeperRoster,
  picks: SleeperTradedPick[],
): TradeCenterParty {
  const playerById = new Map(
    snapshot.players.map((player) => [player.id, player]),
  );
  const players = rosterPlayers(roster, playerById);
  const lineup = projectLineup(context, snapshot, roster, players, new Set());
  const playerAssets = players
    .map((player) => playerAsset(context, snapshot, roster.roster_id, player))
    .toSorted(
      (left, right) =>
        right.tradeAsset.marketValue - left.tradeAsset.marketValue ||
        left.label.localeCompare(right.label),
    );
  const pickAssets = picks
    .filter((pick) => pick.owner_id === roster.roster_id)
    .map((pick) => pickAsset(context, snapshot, pick))
    .toSorted(
      (left, right) =>
        left.detail.localeCompare(right.detail) ||
        left.label.localeCompare(right.label),
    );
  const totalCapacity = rosterCapacity(context);
  const user = snapshot.users.find(
    (entry) => entry.user_id === roster.owner_id,
  );
  const ownerName = user?.display_name ?? user?.username ?? "Unassigned";
  return {
    rosterId: roster.roster_id,
    teamName: resolveTeamName(snapshot, roster.roster_id),
    ownerName,
    avatarUrl: avatarUrl(user?.avatar),
    assets: [...playerAssets, ...pickAssets],
    playerCount: players.length,
    totalCapacity,
    openSpots: totalCapacity - players.length,
    projectedStarterPoints: lineup.points,
    leagueScoredPlayerCount: lineup.leagueScoredPlayers,
    importedProjectionPlayerCount: lineup.importedProjectionPlayers,
  };
}

function playerAsset(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  ownerRosterId: number,
  player: Player,
): TradeCenterAsset {
  const projection = playerProjection(context, snapshot, player);
  const marketValue = proxyPlayerValue(player);
  const productionValue =
    projection.source !== "proxy"
      ? clamp(projection.weeklyPoints * 4.5, 0, 100)
      : marketValue * 0.86;
  return {
    id: `player:${player.id}`,
    kind: "player",
    ownerRosterId,
    label: player.fullName,
    detail: `${player.position} · ${player.team ?? "FA"}`,
    sourceLabel:
      projection.source === "league_scored"
        ? `${projection.weeklyPoints.toFixed(1)} league-scored pts/week`
        : projection.source === "imported"
          ? `${projection.weeklyPoints.toFixed(1)} imported projection pts/week`
          : "Player-rank value proxy",
    player,
    tradeAsset: {
      id: player.id,
      type: "player",
      label: player.fullName,
      position: player.position,
      marketValue,
      productionValue,
      dynastyValue: clamp(
        marketValue +
          (player.age && player.age < 25
            ? 8
            : player.age && player.age > 29
              ? -8
              : 0),
        0,
        100,
      ),
      age: player.age,
      injuryRisk: player.status === "injured" ? 0.55 : 0.15,
      rosterSpaceCost: 1,
      liquidity: marketValue / 100,
    },
  };
}

function pickAsset(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  pick: SleeperTradedPick,
): TradeCenterAsset {
  const value = futurePickValue(context, pick);
  const originalOwner = resolveTeamName(snapshot, pick.roster_id);
  const label = futurePickLabel(snapshot, pick);
  const via =
    pick.roster_id === pick.owner_id ? "Original pick" : `via ${originalOwner}`;
  return {
    id: pickId(pick),
    kind: "pick",
    ownerRosterId: pick.owner_id,
    label,
    detail: via,
    sourceLabel: "Future-pick value proxy",
    player: null,
    tradeAsset: {
      id: pickId(pick),
      type: "pick",
      label: `${label}${via === "Original pick" ? "" : ` · ${via}`}`,
      marketValue: value,
      productionValue: Math.max(4, value * 0.35),
      dynastyValue: Math.min(100, value * 1.12),
      liquidity: pick.round === 1 ? 0.95 : pick.round === 2 ? 0.76 : 0.58,
    },
  };
}

function projectLineup(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  originalRoster: SleeperRoster,
  players: Player[],
  incomingPlayerIds: Set<string>,
): {
  points: number;
  leagueScoredPlayers: number;
  importedProjectionPlayers: number;
} {
  const reserve = new Set(originalRoster.reserve ?? []);
  const taxi = new Set(originalRoster.taxi ?? []);
  const projections = players.map((player) => ({
    player,
    projection: playerProjection(context, snapshot, player),
  }));
  const solution = optimizeLineup({
    rosterPositions: context.rosterPositions,
    alternativeCount: 0,
    players: projections.map(({ player, projection }) => ({
      playerId: player.id,
      name: player.fullName,
      eligiblePositions: player.fantasyPositions.length
        ? player.fantasyPositions
        : [player.position],
      expectedPoints: projection.weeklyPoints,
      floor: projection.weeklyPoints * 0.72,
      ceiling: projection.weeklyPoints * 1.35,
      availabilityProbability:
        player.status === "inactive"
          ? 0
          : player.status === "injured" || player.injuryStatus
            ? 0.72
            : 1,
      inactive: player.status === "inactive",
      onIr: !incomingPlayerIds.has(player.id) && reserve.has(player.id),
      onTaxi: !incomingPlayerIds.has(player.id) && taxi.has(player.id),
    })),
  });
  const weeklyByPlayerId = new Map(
    projections.map(({ player, projection }) => [
      player.id,
      projection.weeklyPoints,
    ]),
  );
  return {
    points: round(
      solution.assignments.reduce(
        (sum, assignment) =>
          sum +
          (assignment.playerId
            ? (weeklyByPlayerId.get(assignment.playerId) ?? 0)
            : 0),
        0,
      ),
    ),
    leagueScoredPlayers: projections.filter(
      ({ projection }) => projection.source === "league_scored",
    ).length,
    importedProjectionPlayers: projections.filter(
      ({ projection }) => projection.source === "imported",
    ).length,
  };
}

function playerProjection(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  player: Player,
): ProjectionResult {
  const projection = snapshot.projections.find(
    (candidate) => candidate.player_id === player.id,
  );
  if (projection) {
    const imported = importedProjectionPoints(projection.stats);
    const activeScoring = Object.values(context.scoringSettings).some(
      (value) => Number.isFinite(value) && value !== 0,
    );
    const result = activeScoring
      ? calculateFantasyScore({
          scoringSettings: context.scoringSettings,
          rawStats: projection.stats,
          importedProjection: imported,
        })
      : null;
    const scored = result?.points ?? imported;
    if (typeof scored === "number" && Number.isFinite(scored)) {
      return {
        weeklyPoints: round(scored / 17),
        source:
          result && !result.usedImportedProjection
            ? "league_scored"
            : "imported",
      };
    }
  }
  return {
    weeklyPoints: round(proxyPlayerValue(player) / 7),
    source: "proxy",
  };
}

function reconstructFuturePicks(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
): SleeperTradedPick[] {
  const pickTrading = numericSetting(context.settings, "pick_trading", 0) > 0;
  if (
    context.leagueType !== "dynasty" &&
    !pickTrading &&
    snapshot.tradedPicks.length === 0
  ) {
    return [];
  }
  const currentDraft =
    snapshot.drafts.find(
      (draft) => draft.draft_id === snapshot.league.draft_id,
    ) ?? snapshot.drafts.find((draft) => draft.season === context.season);
  const configuredRounds = numericSetting(
    currentDraft?.settings ?? {},
    "rounds",
    0,
  );
  const tradedRounds = Math.max(
    0,
    ...snapshot.tradedPicks.map((pick) => pick.round),
  );
  const rounds = Math.max(
    1,
    Math.min(
      8,
      configuredRounds ||
        tradedRounds ||
        (context.leagueType === "dynasty" ? 3 : 1),
    ),
  );
  const season = Number.parseInt(context.season, 10);
  const seasons = Number.isFinite(season)
    ? [
        currentDraft?.status === "complete" ? season + 1 : season,
        currentDraft?.status === "complete" ? season + 2 : season + 1,
        currentDraft?.status === "complete" ? season + 3 : season + 2,
      ].map(String)
    : [context.season];
  const overrides = new Map(
    snapshot.tradedPicks.map((pick) => [pickKey(pick), pick]),
  );
  const reconstructed: SleeperTradedPick[] = [];
  for (const pickSeason of seasons) {
    for (const roster of snapshot.rosters) {
      for (let round = 1; round <= rounds; round += 1) {
        const fallback: SleeperTradedPick = {
          season: pickSeason,
          round,
          roster_id: roster.roster_id,
          previous_owner_id: roster.roster_id,
          owner_id: roster.roster_id,
        };
        reconstructed.push(overrides.get(pickKey(fallback)) ?? fallback);
      }
    }
  }
  const minimumSeason = Number.parseInt(seasons[0] ?? context.season, 10);
  for (const traded of snapshot.tradedPicks) {
    const tradedSeason = Number.parseInt(traded.season, 10);
    if (
      Number.isFinite(minimumSeason) &&
      Number.isFinite(tradedSeason) &&
      tradedSeason < minimumSeason
    ) {
      continue;
    }
    if (!reconstructed.some((pick) => pickKey(pick) === pickKey(traded))) {
      reconstructed.push(traded);
    }
  }
  return reconstructed;
}

function rosterPlayers(
  roster: SleeperRoster,
  playerById: ReadonlyMap<string, Player>,
): Player[] {
  return (roster.players ?? []).flatMap((playerId) => {
    const player = playerById.get(playerId);
    return player ? [player] : [];
  });
}

function rosterCapacity(context: LeagueContext): number {
  const active = context.rosterPositions.filter(
    (slot) => !["IR", "RESERVE", "TAXI"].includes(slot.toUpperCase()),
  ).length;
  const listedReserve = context.rosterPositions.filter((slot) =>
    ["IR", "RESERVE"].includes(slot.toUpperCase()),
  ).length;
  const listedTaxi = context.rosterPositions.filter(
    (slot) => slot.toUpperCase() === "TAXI",
  ).length;
  const reserve = Math.max(
    listedReserve,
    numericSetting(context.settings, "reserve_slots", 0),
  );
  const taxi = Math.max(
    listedTaxi,
    numericSetting(context.settings, "taxi_slots", 0),
  );
  return active + reserve + taxi;
}

function resolveTeamName(snapshot: LeagueSnapshot, rosterId: number): string {
  const roster = snapshot.rosters.find(
    (candidate) => candidate.roster_id === rosterId,
  );
  const user = snapshot.users.find(
    (candidate) => candidate.user_id === roster?.owner_id,
  );
  const metadata = user?.metadata ?? {};
  return typeof metadata["team_name"] === "string"
    ? metadata["team_name"]
    : (user?.display_name ?? user?.username ?? `Roster ${rosterId}`);
}

function avatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("https://sleepercdn.com/")) return value;
  return /^[a-zA-Z0-9_-]+$/.test(value)
    ? `https://sleepercdn.com/avatars/${value}`
    : null;
}

function importedProjectionPoints(
  stats: Record<string, number | null>,
): number | null {
  for (const key of ["pts_ppr", "pts_half_ppr", "pts_std", "pts"]) {
    const value = stats[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function futurePickValue(
  context: LeagueContext,
  pick: SleeperTradedPick,
): number {
  const roundValue =
    pick.round === 1
      ? 72
      : pick.round === 2
        ? 46
        : pick.round === 3
          ? 29
          : Math.max(10, 34 - pick.round * 5);
  const current = Number.parseInt(context.season, 10);
  const season = Number.parseInt(pick.season, 10);
  const yearsAway =
    Number.isFinite(current) && Number.isFinite(season)
      ? Math.max(0, season - current)
      : 1;
  return round(roundValue * Math.max(0.7, 1 - yearsAway * 0.08));
}

function futurePickLabel(
  snapshot: LeagueSnapshot,
  pick: SleeperTradedPick,
): string {
  const base = `${pick.season} ${ordinal(pick.round)} Rd`;
  const draft = snapshot.drafts.find(
    (candidate) =>
      candidate.season === pick.season && candidate.status !== "complete",
  );
  if (!draft) return base;
  const roster = snapshot.rosters.find(
    (candidate) => candidate.roster_id === pick.roster_id,
  );
  const slotFromRosterMap = Object.entries(draft.slot_to_roster_id ?? {}).find(
    ([, rosterId]) => rosterId === pick.roster_id,
  )?.[0];
  const slotFromOrder = roster?.owner_id
    ? draft.draft_order?.[roster.owner_id]
    : undefined;
  const slot = Number(slotFromRosterMap ?? slotFromOrder);
  return Number.isInteger(slot) && slot > 0
    ? `${base} - ${pick.round}.${String(slot).padStart(2, "0")}`
    : base;
}

function proxyPlayerValue(player: Player): number {
  const rank = player.searchRank ?? 500;
  return clamp(102 - Math.log2(Math.max(2, rank)) * 8, 8, 98);
}

function pickId(pick: SleeperTradedPick): string {
  return `pick:${pick.season}:${pick.round}:${pick.roster_id}`;
}

function pickKey(
  pick: Pick<SleeperTradedPick, "season" | "round" | "roster_id">,
): string {
  return `${pick.season}:${pick.round}:${pick.roster_id}`;
}

function ordinal(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function numericSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = settings[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
