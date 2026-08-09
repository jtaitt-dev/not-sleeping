import type { DraftPlayerPool, DraftStyle, LeagueType } from "@/types/league";
import {
  isIdpPosition,
  isPlayerEligibleForAnyRosterSlot,
  isPlayerEligibleForRosterSlot,
  normalizeSleeperPosition,
} from "@/services/roster/position-eligibility";

export type OpponentArchetype =
  | "adp_follower"
  | "best_player_available"
  | "positional_need"
  | "zero_rb"
  | "hero_rb"
  | "early_qb"
  | "late_qb"
  | "te_premium"
  | "superflex_qb_hoarder"
  | "dynasty_youth"
  | "dynasty_contender"
  | "productive_struggle"
  | "idp_early"
  | "homer"
  | "random_within_tier";

export type DraftEnginePlayer = {
  playerId: string;
  name: string;
  positions: string[];
  team?: string;
  adp: number;
  tier: number;
  redraftValue: number;
  dynastyValue: number;
  contenderValue: number;
  rookie: boolean;
  age?: number;
  auctionValue?: number;
};

export type DraftEngineConfig = {
  seed: number;
  leagueType: LeagueType;
  teams: number;
  rounds: number;
  style: DraftStyle;
  playerPool: DraftPlayerPool;
  rosterSlots: string[];
  userSlot: number;
  opponentArchetypes: OpponentArchetype[];
  tradedPickOwners?: Record<number, number>;
  keepers?: Record<number, string>;
  manualAllTeams?: boolean;
  superflex?: boolean;
  tePremium?: boolean;
  idp?: boolean;
  bestBall?: boolean;
  favoriteTeam?: string;
  auctionBudget?: number;
  minimumAuctionBid?: number;
  recordHistory?: boolean;
  unavailablePlayerIds?: string[];
  positionLimits?: Record<string, number>;
};

export type DraftEnginePick = {
  pickNumber: number;
  round: number;
  pickInRound: number;
  draftSlot: number;
  ownerSlot: number;
  playerId: string;
  isKeeper: boolean;
  price?: number;
};

export type DraftRecommendation = {
  playerId: string;
  score: number;
  rank: number;
  tier: number;
  availabilityAtNextPick: number;
  factors: string[];
};

export type DraftEngineState = {
  status: "pre_draft" | "drafting" | "paused" | "complete";
  picks: DraftEnginePick[];
  availablePlayerIds: string[];
  rosters: Record<number, string[]>;
  budgets: Record<number, number>;
  currentPick: number;
  recommendationLatencyMs: number;
};

export type DraftInvariantResult = {
  passed: boolean;
  errors: string[];
};

export class MockDraftSession {
  private history: DraftEngineState[] = [];
  private future: DraftEngineState[] = [];
  private state: DraftEngineState;
  private readonly playerById: Map<string, DraftEnginePlayer>;

  constructor(
    readonly config: DraftEngineConfig,
    readonly players: DraftEnginePlayer[],
  ) {
    validateConfig(config);
    this.playerById = new Map(
      players.map((player) => [player.playerId, player]),
    );
    const filtered = draftablePlayerPool(players, config);
    if (filtered.length < config.teams * config.rounds) {
      throw new Error(
        `The configured player pool has ${filtered.length} eligible players for ${config.teams * config.rounds} selections.`,
      );
    }
    this.state = {
      status: "pre_draft",
      picks: [],
      availablePlayerIds: filtered.map((player) => player.playerId),
      rosters: Object.fromEntries(
        Array.from({ length: config.teams }, (_, index) => [index + 1, []]),
      ),
      budgets: Object.fromEntries(
        Array.from({ length: config.teams }, (_, index) => [
          index + 1,
          config.auctionBudget ?? 200,
        ]),
      ),
      currentPick: 1,
      recommendationLatencyMs: 0,
    };
  }

  static restore(
    config: DraftEngineConfig,
    players: DraftEnginePlayer[],
    state: DraftEngineState,
  ): MockDraftSession {
    const session = new MockDraftSession(config, players);
    session.restoreState(state);
    return session;
  }

  snapshot(): DraftEngineState {
    return structuredClone(this.state);
  }

  start(): DraftEngineState {
    if (this.state.status === "pre_draft")
      this.commit({ ...this.state, status: "drafting" });
    return this.snapshot();
  }

  pause(): DraftEngineState {
    if (this.state.status === "drafting")
      this.commit({ ...this.state, status: "paused" });
    return this.snapshot();
  }

  resume(): DraftEngineState {
    if (this.state.status === "paused")
      this.commit({ ...this.state, status: "drafting" });
    return this.snapshot();
  }

  undo(): DraftEngineState {
    const prior = this.history.pop();
    if (!prior) return this.snapshot();
    this.future.push(structuredClone(this.state));
    this.state = prior;
    return this.snapshot();
  }

  redo(): DraftEngineState {
    const next = this.future.pop();
    if (!next) return this.snapshot();
    this.history.push(structuredClone(this.state));
    this.state = next;
    return this.snapshot();
  }

  recommendations(limit = 10): DraftRecommendation[] {
    const started = performanceNow();
    const ownerSlot = ownerForPick(this.config, this.state.currentPick);
    const roster = this.state.rosters[ownerSlot] ?? [];
    const available = new Set(this.state.availablePlayerIds);
    const candidates = this.players.filter(
      (player) =>
        available.has(player.playerId) &&
        respectsPositionLimits(player, roster, this.playerById, this.config),
    );
    const archetype =
      ownerSlot === this.config.userSlot
        ? "best_player_available"
        : (this.config.opponentArchetypes[
            (ownerSlot - 1) % this.config.opponentArchetypes.length
          ] ?? "adp_follower");
    const maximum = Math.max(1, Math.min(100, limit));
    const feasibilityByPositions = new Map<string, boolean>();
    const feasibleCandidates = candidates.filter((player) => {
      const key = player.positions
        .map(normalizeSleeperPosition)
        .toSorted()
        .join("|");
      const cached = feasibilityByPositions.get(key);
      if (cached !== undefined) return cached;
      const feasible = preservesRosterFeasibility(
        [...roster, player.playerId],
        ownerSlot,
        this.config,
        this.playerById,
      );
      feasibilityByPositions.set(key, feasible);
      return feasible;
    });
    const ranked = rankDraftCandidates({
      config: this.config,
      candidates: feasibleCandidates,
      rosterPlayerIds: roster,
      allPlayers: this.players,
      pickNumber: this.state.currentPick,
      archetype,
      seed: this.config.seed,
      limit: maximum,
    });
    this.state.recommendationLatencyMs = performanceNow() - started;
    return ranked;
  }

  isLegalPick(playerId: string): boolean {
    if (this.state.status !== "drafting") return false;
    if (!this.state.availablePlayerIds.includes(playerId)) return false;
    const player = this.playerById.get(playerId);
    if (!player || !filterDraftPool([player], this.config).length) return false;
    const ownerSlot = ownerForPick(this.config, this.state.currentPick);
    const roster = this.state.rosters[ownerSlot] ?? [];
    return (
      roster.length < totalOwnedPicks(this.config, ownerSlot) &&
      respectsPositionLimits(player, roster, this.playerById, this.config) &&
      preservesRosterFeasibility(
        [...roster, player.playerId],
        ownerSlot,
        this.config,
        this.playerById,
      )
    );
  }

  isUserOnClock(): boolean {
    return (
      this.state.status === "drafting" &&
      ownerForPick(this.config, this.state.currentPick) === this.config.userSlot
    );
  }

  makeUserPick(playerId: string, price?: number): DraftEngineState {
    if (!this.isUserOnClock()) {
      throw new Error(
        "A manual user pick is only legal when the user is on the clock.",
      );
    }
    this.applyPick(playerId, price);
    return this.snapshot();
  }

  simulateOpponentsToUserTurn(): DraftEngineState {
    this.start();
    while (
      this.state.status === "drafting" &&
      ownerForPick(this.config, this.state.currentPick) !== this.config.userSlot
    ) {
      this.applyPick();
    }
    return this.snapshot();
  }

  makePick(playerId?: string, price?: number): DraftEngineState {
    this.applyPick(playerId, price);
    return this.snapshot();
  }

  autoComplete(): DraftEngineState {
    this.start();
    while (this.state.status === "drafting") this.applyPick();
    return this.snapshot();
  }

  private applyPick(playerId?: string, price?: number): void {
    if (this.state.status === "pre_draft") this.start();
    if (this.state.status !== "drafting") return;
    const pickNumber = this.state.currentPick;
    const keeperId = this.config.keepers?.[pickNumber];
    const ownerSlot = ownerForPick(this.config, pickNumber);
    const selectedId =
      keeperId ?? playerId ?? this.recommendations(1)[0]?.playerId;
    if (!selectedId || !this.state.availablePlayerIds.includes(selectedId)) {
      throw new Error("The selected player is not legally available.");
    }
    const player = this.playerById.get(selectedId);
    if (!player || !filterDraftPool([player], this.config).length) {
      throw new Error(
        "The selected player is outside the configured player pool.",
      );
    }
    const roster = this.state.rosters[ownerSlot] ?? [];
    if (!respectsPositionLimits(player, roster, this.playerById, this.config)) {
      throw new Error(
        "The selected player exceeds this league's position limits.",
      );
    }
    if (roster.length >= totalOwnedPicks(this.config, ownerSlot)) {
      throw new Error("The roster has no remaining owned draft selections.");
    }
    if (
      !preservesRosterFeasibility(
        [...roster, selectedId],
        ownerSlot,
        this.config,
        this.playerById,
      )
    ) {
      throw new Error(
        "The selected player would leave this roster unable to fill its legal position slots.",
      );
    }
    let resolvedPrice: number | undefined;
    const budgets = { ...this.state.budgets };
    if (this.config.style === "auction") {
      const minimum = this.config.minimumAuctionBid ?? 1;
      const remaining = budgets[ownerSlot] ?? 0;
      const remainingSlotsAfterWin = Math.max(
        0,
        this.config.rounds - roster.length - 1,
      );
      const maximum = Math.max(0, remaining - remainingSlotsAfterWin * minimum);
      resolvedPrice = Math.round(
        price ?? Math.min(maximum, Math.max(minimum, player.auctionValue ?? 1)),
      );
      if (resolvedPrice < minimum || resolvedPrice > maximum) {
        throw new Error(
          `Auction price must be between ${minimum} and ${maximum}.`,
        );
      }
      budgets[ownerSlot] = remaining - resolvedPrice;
    }
    const coordinates = pickCoordinates(this.config, pickNumber);
    const pick: DraftEnginePick = {
      pickNumber,
      round: coordinates.round,
      pickInRound: coordinates.pickInRound,
      draftSlot: coordinates.draftSlot,
      ownerSlot,
      playerId: selectedId,
      isKeeper: Boolean(keeperId),
      ...(resolvedPrice !== undefined ? { price: resolvedPrice } : {}),
    };
    const nextPick = pickNumber + 1;
    this.commit({
      ...this.state,
      picks: [...this.state.picks, pick],
      availablePlayerIds: this.state.availablePlayerIds.filter(
        (id) => id !== selectedId,
      ),
      rosters: { ...this.state.rosters, [ownerSlot]: [...roster, selectedId] },
      budgets,
      currentPick: nextPick,
      status:
        nextPick > this.config.teams * this.config.rounds
          ? "complete"
          : "drafting",
    });
  }

  injectTrade(pickNumber: number, ownerSlot: number): void {
    if (!Number.isInteger(pickNumber) || pickNumber < this.state.currentPick) {
      throw new Error("Only future picks can be traded in the active mock.");
    }
    if (ownerSlot < 1 || ownerSlot > this.config.teams)
      throw new Error("Invalid owner slot.");
    this.config.tradedPickOwners = {
      ...(this.config.tradedPickOwners ?? {}),
      [pickNumber]: ownerSlot,
    };
  }

  injectKeeper(pickNumber: number, playerId: string): void {
    if (pickNumber < this.state.currentPick)
      throw new Error("A completed pick cannot become a keeper.");
    if (!this.state.availablePlayerIds.includes(playerId))
      throw new Error("Keeper is not available.");
    this.config.keepers = {
      ...(this.config.keepers ?? {}),
      [pickNumber]: playerId,
    };
  }

  private commit(next: DraftEngineState): void {
    if (this.config.recordHistory !== false) {
      this.history.push(structuredClone(this.state));
    }
    this.future = [];
    this.state =
      this.config.recordHistory === false ? next : structuredClone(next);
  }

  private restoreState(state: DraftEngineState): void {
    const validation = assertDraftInvariants(this.config, state, this.players);
    if (!validation.passed) {
      throw new Error(
        `Saved mock draft is invalid: ${validation.errors.join(" ")}`,
      );
    }
    const expectedCurrentPick = state.picks.length + 1;
    const maximum = this.config.teams * this.config.rounds;
    if (
      state.currentPick !== expectedCurrentPick ||
      state.currentPick < 1 ||
      state.currentPick > maximum + 1
    ) {
      throw new Error("Saved mock draft has an invalid current pick.");
    }
    if (
      (state.status === "complete" && state.currentPick !== maximum + 1) ||
      (state.status !== "complete" && state.currentPick > maximum)
    ) {
      throw new Error("Saved mock draft has an invalid completion status.");
    }
    const drafted = new Set(state.picks.map((pick) => pick.playerId));
    const expectedAvailable = draftablePlayerPool(this.players, this.config)
      .map((player) => player.playerId)
      .filter((playerId) => !drafted.has(playerId));
    if (!sameStringSet(expectedAvailable, state.availablePlayerIds)) {
      throw new Error(
        "Saved mock draft has a stale or mismatched player pool.",
      );
    }
    this.state = structuredClone(state);
    this.history = [];
    this.future = [];
  }
}

export function pickCoordinates(
  config: Pick<DraftEngineConfig, "teams" | "style">,
  pickNumber: number,
): { round: number; pickInRound: number; draftSlot: number } {
  const round = Math.floor((pickNumber - 1) / config.teams) + 1;
  const pickInRound = ((pickNumber - 1) % config.teams) + 1;
  const ascending = isAscendingRound(config.style, round);
  const draftSlot = ascending ? pickInRound : config.teams - pickInRound + 1;
  return { round, pickInRound, draftSlot };
}

export function isAscendingRound(style: DraftStyle, round: number): boolean {
  if (style === "linear" || style === "manual_custom" || style === "auction")
    return true;
  if (style === "third_round_reversal") {
    if (round === 1) return true;
    if (round === 2 || round === 3) return false;
    return round % 2 === 0;
  }
  return round % 2 === 1;
}

export function ownerForPick(
  config: DraftEngineConfig,
  pickNumber: number,
): number {
  return (
    config.tradedPickOwners?.[pickNumber] ??
    pickCoordinates(config, pickNumber).draftSlot
  );
}

export function rankDraftCandidates(input: {
  config: DraftEngineConfig;
  candidates: DraftEnginePlayer[];
  rosterPlayerIds: string[];
  allPlayers: DraftEnginePlayer[];
  pickNumber: number;
  archetype: OpponentArchetype;
  seed: number;
  limit?: number;
}): DraftRecommendation[] {
  const rosterIds = new Set(input.rosterPlayerIds);
  const roster = input.allPlayers.filter((player) =>
    rosterIds.has(player.playerId),
  );
  const round = Math.floor((input.pickNumber - 1) / input.config.teams) + 1;
  const nextPick = nextPickForOwner(
    input.config,
    input.pickNumber,
    ownerForPick(input.config, input.pickNumber),
  );
  const needs = rosterNeeds(input.config.rosterSlots, roster);
  const random = seededRandom(
    input.seed ^ input.pickNumber ^ hash(input.archetype),
  );
  const recommendations = input.candidates.map((player) => {
    const primary = player.positions[0]?.toUpperCase() ?? "FLEX";
    const value =
      input.config.leagueType === "dynasty"
        ? player.dynastyValue
        : player.redraftValue;
    const need = needs[primary] ?? 0;
    const adpValue = clamp(
      100 - Math.max(0, player.adp - input.pickNumber) * 0.65,
      0,
      100,
    );
    const factors: string[] = [];
    let score = value * 0.62 + adpValue * 0.18 + need * 140;
    if (need > 0.65) factors.push(`${primary} roster need`);
    if (player.adp <= input.pickNumber + input.config.teams)
      factors.push("ADP value window");
    if (input.config.superflex && primary === "QB") {
      score += 12;
      factors.push("Superflex quarterback premium");
    }
    if (input.config.tePremium && primary === "TE") {
      score += 7;
      factors.push("Tight-end premium");
    }
    if (isIdpPosition(primary)) {
      const hasIdpSlot = input.config.rosterSlots.some(
        (slot) =>
          slot.toUpperCase() === "IDP_FLEX" ||
          isIdpPosition(slot.toUpperCase()),
      );
      score += input.config.idp && hasIdpSlot ? (round <= 8 ? -4 : 5) : -1_000;
    }
    score += archetypeAdjustment(
      input.archetype,
      player,
      roster,
      round,
      input.config,
    );
    if (input.archetype === "random_within_tier") score += random() * 8 - 4;
    const draftedBeforeNext =
      nextPick === null
        ? 1
        : clamp(
            ((nextPick - player.adp) / Math.max(4, input.config.teams)) * 0.5 +
              0.5,
            0.02,
            0.98,
          );
    const availabilityAtNextPick = roundTo(
      clamp(1 - draftedBeforeNext, 0.01, 0.99),
      3,
    );
    return {
      playerId: player.playerId,
      score: roundTo(score, 3),
      rank: 0,
      tier: player.tier,
      availabilityAtNextPick,
      factors: factors.length > 0 ? factors : ["Best available value"],
    };
  });
  const requested = input.limit;
  const ranked =
    requested !== undefined && requested < recommendations.length
      ? selectTopRecommendations(recommendations, requested)
      : recommendations.toSorted(compareRecommendations);
  return ranked.map((recommendation, index) => ({
    ...recommendation,
    rank: index + 1,
  }));
}

function selectTopRecommendations(
  recommendations: DraftRecommendation[],
  limit: number,
): DraftRecommendation[] {
  const maximum = Math.max(1, Math.floor(limit));
  const top: DraftRecommendation[] = [];
  for (const recommendation of recommendations) {
    let low = 0;
    let high = top.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const current = top[middle];
      if (
        current === undefined ||
        compareRecommendations(recommendation, current) < 0
      ) {
        high = middle;
      } else {
        low = middle + 1;
      }
    }
    if (low < maximum) {
      top.splice(low, 0, recommendation);
      if (top.length > maximum) top.pop();
    }
  }
  return top;
}

function compareRecommendations(
  left: DraftRecommendation,
  right: DraftRecommendation,
): number {
  return (
    right.score - left.score ||
    left.tier - right.tier ||
    left.playerId.localeCompare(right.playerId)
  );
}

export function assertDraftInvariants(
  config: DraftEngineConfig,
  state: DraftEngineState,
  players: DraftEnginePlayer[],
): DraftInvariantResult {
  const errors: string[] = [];
  const drafted = new Set<string>();
  const playerById = new Map(
    players.map((player) => [player.playerId, player]),
  );
  const pool = new Set(
    draftablePlayerPool(players, config).map((player) => player.playerId),
  );
  for (const [index, pick] of state.picks.entries()) {
    if (pick.pickNumber !== index + 1)
      errors.push(`Out-of-order pick ${pick.pickNumber}.`);
    const expected = pickCoordinates(config, pick.pickNumber);
    if (
      pick.round !== expected.round ||
      pick.pickInRound !== expected.pickInRound ||
      pick.draftSlot !== expected.draftSlot
    ) {
      errors.push(`Incorrect order at pick ${pick.pickNumber}.`);
    }
    if (pick.ownerSlot !== ownerForPick(config, pick.pickNumber)) {
      errors.push(`Incorrect traded-pick owner at pick ${pick.pickNumber}.`);
    }
    if (drafted.has(pick.playerId))
      errors.push(`Duplicate player ${pick.playerId}.`);
    drafted.add(pick.playerId);
    if (!pool.has(pick.playerId))
      errors.push(`Player ${pick.playerId} leaked across player pools.`);
    if (config.keepers?.[pick.pickNumber] && !pick.isKeeper) {
      errors.push(`Keeper placement missing at pick ${pick.pickNumber}.`);
    }
  }
  for (const [slot, roster] of Object.entries(state.rosters)) {
    const owned = totalOwnedPicks(config, Number(slot));
    if (roster.length > owned)
      errors.push(`Roster ${slot} exceeds ${owned} owned selections.`);
    const rosterPlayers = roster.flatMap((playerId) => {
      const player = playerById.get(playerId);
      return player ? [player] : [];
    });
    for (const [position, limit] of Object.entries(
      config.positionLimits ?? {},
    )) {
      const count = rosterPlayers.filter((player) =>
        player.positions
          .map(normalizeSleeperPosition)
          .includes(normalizeSleeperPosition(position)),
      ).length;
      if (count > limit) {
        errors.push(
          `Roster ${slot} exceeds the ${position} limit of ${limit}.`,
        );
      }
    }
    if (
      owned >= config.rosterSlots.length &&
      !preservesRosterFeasibility(roster, Number(slot), config, playerById)
    ) {
      const positions = roster.map(
        (playerId) =>
          playerById.get(playerId)?.positions.join("/") ?? "unknown",
      );
      errors.push(
        `Roster ${slot} cannot fill the configured legal slots (${positions.join(", ")}).`,
      );
    }
  }
  for (const [slot, budget] of Object.entries(state.budgets)) {
    if (!Number.isFinite(budget) || budget < 0)
      errors.push(`Roster ${slot} has invalid budget.`);
  }
  if (config.style === "auction") {
    const minimum = config.minimumAuctionBid ?? 1;
    const spent: Record<number, number> = {};
    for (const pick of state.picks) {
      const price = pick.price;
      if (price === undefined || !Number.isFinite(price) || price < minimum) {
        errors.push(`Auction pick ${pick.pickNumber} has an invalid price.`);
        continue;
      }
      spent[pick.ownerSlot] = (spent[pick.ownerSlot] ?? 0) + price;
      if ((spent[pick.ownerSlot] ?? 0) > (config.auctionBudget ?? 200)) {
        errors.push(`Roster ${pick.ownerSlot} exceeded its auction budget.`);
      }
    }
  }
  if (!Number.isFinite(state.recommendationLatencyMs))
    errors.push("Recommendation latency is invalid.");
  return { passed: errors.length === 0, errors };
}

function hasLegalDraftRoster(
  rosterIds: string[],
  slots: string[],
  playerById: ReadonlyMap<string, DraftEnginePlayer>,
): boolean {
  const orderedPlayers = rosterIds.toSorted(
    (left, right) =>
      eligibleSlotCount(left, slots, playerById) -
      eligibleSlotCount(right, slots, playerById),
  );
  const playerForSlot = Array.from({ length: slots.length }, () => -1);
  const assign = (playerIndex: number, visitedSlots: Set<number>): boolean => {
    const player = playerById.get(orderedPlayers[playerIndex] ?? "");
    if (!player) return false;
    for (const [slotIndex, slot] of slots.entries()) {
      if (visitedSlots.has(slotIndex)) continue;
      if (!isPlayerEligibleForRosterSlot(slot, player.positions)) continue;
      visitedSlots.add(slotIndex);
      const currentPlayer = playerForSlot[slotIndex] ?? -1;
      if (currentPlayer === -1 || assign(currentPlayer, visitedSlots)) {
        playerForSlot[slotIndex] = playerIndex;
        return true;
      }
    }
    return false;
  };
  return orderedPlayers.every((_, index) => assign(index, new Set<number>()));
}

function eligibleSlotCount(
  playerId: string,
  slots: string[],
  playerById: ReadonlyMap<string, DraftEnginePlayer>,
): number {
  const player = playerById.get(playerId);
  if (!player) return 0;
  return slots.reduce(
    (total, slot) =>
      total + Number(isPlayerEligibleForRosterSlot(slot, player.positions)),
    0,
  );
}

function preservesRosterFeasibility(
  rosterIds: string[],
  ownerSlot: number,
  config: DraftEngineConfig,
  playerById: ReadonlyMap<string, DraftEnginePlayer>,
): boolean {
  const ownedPicks = totalOwnedPicks(config, ownerSlot);
  if (ownedPicks < config.rosterSlots.length) return true;
  const overflowBenchSlots = Math.max(
    0,
    ownedPicks - config.rosterSlots.length,
  );
  const effectiveSlots = [
    ...config.rosterSlots,
    ...Array.from({ length: overflowBenchSlots }, () => "BN"),
  ];
  return hasLegalDraftRoster(rosterIds, effectiveSlots, playerById);
}

export function filterPlayerPool(
  players: DraftEnginePlayer[],
  pool: DraftPlayerPool,
): DraftEnginePlayer[] {
  if (pool === "rookies_only") return players.filter((player) => player.rookie);
  if (pool === "veterans_only")
    return players.filter((player) => !player.rookie);
  return players;
}

export function draftablePlayerPool(
  players: DraftEnginePlayer[],
  config: DraftEngineConfig,
): DraftEnginePlayer[] {
  const unavailable = new Set(config.unavailablePlayerIds ?? []);
  return filterDraftPool(players, config).filter(
    (player) => !unavailable.has(player.playerId),
  );
}

function filterDraftPool(
  players: DraftEnginePlayer[],
  config: DraftEngineConfig,
): DraftEnginePlayer[] {
  return filterPlayerPool(players, config.playerPool).filter((player) =>
    isPlayerEligibleForAnyRosterSlot(config.rosterSlots, player.positions),
  );
}

function nextPickForOwner(
  config: DraftEngineConfig,
  currentPick: number,
  ownerSlot: number,
): number | null {
  const maximum = config.teams * config.rounds;
  for (let pick = currentPick + 1; pick <= maximum; pick += 1) {
    if (ownerForPick(config, pick) === ownerSlot) return pick;
  }
  return null;
}

function totalOwnedPicks(config: DraftEngineConfig, ownerSlot: number): number {
  let total = config.rounds;
  for (const [pickValue, currentOwner] of Object.entries(
    config.tradedPickOwners ?? {},
  )) {
    const pickNumber = Number(pickValue);
    if (
      !Number.isInteger(pickNumber) ||
      pickNumber < 1 ||
      pickNumber > config.teams * config.rounds
    ) {
      continue;
    }
    const originalOwner = pickCoordinates(config, pickNumber).draftSlot;
    if (originalOwner === ownerSlot && currentOwner !== ownerSlot) total -= 1;
    if (originalOwner !== ownerSlot && currentOwner === ownerSlot) total += 1;
  }
  return total;
}

function respectsPositionLimits(
  player: DraftEnginePlayer,
  rosterIds: string[],
  playerById: Map<string, DraftEnginePlayer>,
  config: DraftEngineConfig,
): boolean {
  const limits = config.positionLimits ?? {};
  if (Object.keys(limits).length === 0) return true;
  return player.positions.some((position) => {
    const normalized = normalizeSleeperPosition(position);
    const limit = limits[normalized];
    if (limit === undefined) return true;
    const count = rosterIds.reduce((total, playerId) => {
      const rosterPlayer = playerById.get(playerId);
      return (
        total +
        Number(
          rosterPlayer?.positions
            .map(normalizeSleeperPosition)
            .includes(normalized) ?? false,
        )
      );
    }, 0);
    return count < limit;
  });
}

function rosterNeeds(
  rosterSlots: string[],
  roster: DraftEnginePlayer[],
): Record<string, number> {
  const required = rosterSlots.reduce<Record<string, number>>(
    (counts, slot) => {
      const normalized = normalizeSleeperPosition(slot);
      if (["BN", "IR", "TAXI"].includes(normalized)) return counts;
      if (
        ["FLEX", "WRRB_FLEX", "REC_FLEX", "SUPER_FLEX", "IDP_FLEX"].includes(
          normalized,
        )
      ) {
        return counts;
      }
      counts[normalized] = (counts[normalized] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const actual = roster.reduce<Record<string, number>>((counts, player) => {
    const position = player.positions[0]?.toUpperCase();
    if (position) counts[position] = (counts[position] ?? 0) + 1;
    return counts;
  }, {});
  return Object.fromEntries(
    Object.entries(required).map(([position, count]) => [
      position,
      clamp((count - (actual[position] ?? 0)) / Math.max(1, count), 0, 1),
    ]),
  );
}

function archetypeAdjustment(
  archetype: OpponentArchetype,
  player: DraftEnginePlayer,
  roster: DraftEnginePlayer[],
  round: number,
  config: DraftEngineConfig,
): number {
  const position = player.positions[0]?.toUpperCase() ?? "";
  const count = roster.filter((entry) =>
    entry.positions.includes(position),
  ).length;
  switch (archetype) {
    case "adp_follower":
      return clamp(24 - player.adp / 5, -12, 18);
    case "positional_need":
      return count === 0 ? 14 : -count * 2;
    case "zero_rb":
      return position === "RB" && round <= 5
        ? -18
        : ["WR", "TE", "QB"].includes(position)
          ? 5
          : 0;
    case "hero_rb":
      return position === "RB" ? (count === 0 ? 18 : round <= 6 ? -10 : 2) : 0;
    case "early_qb":
      return position === "QB" && count === 0 && round <= 4 ? 20 : 0;
    case "late_qb":
      return position === "QB" && round <= 8 ? -18 : 0;
    case "te_premium":
      return position === "TE" ? 14 : 0;
    case "superflex_qb_hoarder":
      return position === "QB" ? Math.max(2, 20 - count * 4) : 0;
    case "dynasty_youth":
      return (
        (player.rookie ? 12 : 0) + Math.max(-8, 28 - (player.age ?? 25)) * 1.2
      );
    case "dynasty_contender":
      return player.contenderValue * 0.16;
    case "productive_struggle":
      return player.dynastyValue * 0.12 - player.contenderValue * 0.08;
    case "idp_early":
      return isIdpPosition(position) ? (round <= 8 ? 16 : 7) : 0;
    case "homer":
      return player.team && player.team === config.favoriteTeam ? 22 : 0;
    case "best_player_available":
    case "random_within_tier":
      return 0;
  }
}

function validateConfig(config: DraftEngineConfig): void {
  if (
    !Number.isInteger(config.teams) ||
    config.teams < 2 ||
    config.teams > 64
  ) {
    throw new Error("Team count must be between 2 and 64.");
  }
  if (
    !Number.isInteger(config.rounds) ||
    config.rounds < 1 ||
    config.rounds > 80
  ) {
    throw new Error("Rounds must be between 1 and 80.");
  }
  if (config.userSlot < 1 || config.userSlot > config.teams)
    throw new Error("Invalid user slot.");
}

function seededRandom(seed: number): () => number {
  let state = seed | 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(31, result) + value.charCodeAt(index);
  }
  return result;
}

function performanceNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTo(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return (
    rightSet.size === right.length && left.every((value) => rightSet.has(value))
  );
}
