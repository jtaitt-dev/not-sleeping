export type LineupStrategy = "floor" | "balanced" | "ceiling";

export type LineupCandidate = {
  playerId: string;
  name: string;
  eligiblePositions: string[];
  expectedPoints: number;
  floor: number;
  ceiling: number;
  availabilityProbability?: number;
  lockedSlotIndex?: number;
  gameStarted?: boolean;
  inactive?: boolean;
  onIr?: boolean;
  onTaxi?: boolean;
};

export type LineupAssignment = {
  slotIndex: number;
  slot: string;
  playerId: string | null;
  score: number;
  locked: boolean;
};

export type LineupAlternative = {
  score: number;
  delta: number;
  assignments: LineupAssignment[];
};

export type LineupSolution = {
  score: number;
  assignments: LineupAssignment[];
  emptySlots: number[];
  excludedPlayerIds: string[];
  alternatives: LineupAlternative[];
  diagnostics: string[];
};

export type LineupOptimizerInput = {
  rosterPositions: string[];
  players: LineupCandidate[];
  strategy?: LineupStrategy;
  excludedPlayerIds?: string[];
  manualSlotMappings?: Record<string, string[]>;
  alternativeCount?: number;
};

const NON_STARTING_SLOTS = new Set(["BN", "IR", "TAXI"]);
const DEFAULT_SLOT_ELIGIBILITY: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  FLEX: ["RB", "WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  DL: ["DL", "DE", "DT", "EDGE"],
  DE: ["DE", "DL", "EDGE"],
  DT: ["DT", "DL"],
  EDGE: ["EDGE", "DE", "DL"],
  LB: ["LB", "ILB", "OLB"],
  ILB: ["ILB", "LB"],
  OLB: ["OLB", "LB", "EDGE"],
  DB: ["DB", "CB", "S", "FS", "SS"],
  CB: ["CB", "DB"],
  S: ["S", "FS", "SS", "DB"],
  FS: ["FS", "S", "DB"],
  SS: ["SS", "S", "DB"],
  IDP_FLEX: [
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
  ],
};

export function optimizeLineup(input: LineupOptimizerInput): LineupSolution {
  const excluded = new Set(input.excludedPlayerIds ?? []);
  const slots = input.rosterPositions
    .map((slot, originalIndex) => ({ slot: normalize(slot), originalIndex }))
    .filter(({ slot }) => !NON_STARTING_SLOTS.has(slot));
  const diagnostics: string[] = [];
  const manualMappings = Object.fromEntries(
    Object.entries(input.manualSlotMappings ?? {}).map(([slot, positions]) => [
      normalize(slot),
      positions.map(normalize),
    ]),
  );
  for (const { slot } of slots) {
    if (!DEFAULT_SLOT_ELIGIBILITY[slot] && !manualMappings[slot]) {
      diagnostics.push(
        `Unknown slot ${slot} has no manual eligibility mapping.`,
      );
    }
  }
  const players = input.players
    .filter(
      (player) =>
        !excluded.has(player.playerId) &&
        !player.inactive &&
        !player.onIr &&
        !player.onTaxi,
    )
    .map((player) => ({
      ...player,
      eligiblePositions: player.eligiblePositions.map(normalize),
    }))
    .toSorted((left, right) => left.playerId.localeCompare(right.playerId));
  const primary = solve(
    slots,
    players,
    input.strategy ?? "balanced",
    manualMappings,
    new Set(),
    diagnostics,
  );
  const alternatives: LineupAlternative[] = [];
  const seen = new Set<string>();
  const alternativeCount = Math.max(
    0,
    Math.min(5, input.alternativeCount ?? 3),
  );
  for (const assignment of primary.assignments) {
    if (!assignment.playerId || assignment.locked) continue;
    const blocked = new Set([`${assignment.slotIndex}:${assignment.playerId}`]);
    const alternate = solve(
      slots,
      players,
      input.strategy ?? "balanced",
      manualMappings,
      blocked,
      diagnostics,
    );
    const key = alternate.assignments
      .map((entry) => entry.playerId ?? "-")
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    alternatives.push({
      score: alternate.score,
      delta: round(alternate.score - primary.score),
      assignments: alternate.assignments,
    });
  }
  alternatives.sort((left, right) => right.score - left.score);
  return {
    ...primary,
    excludedPlayerIds: [...excluded],
    alternatives: alternatives.slice(0, alternativeCount),
    diagnostics: [...new Set(diagnostics)],
  };
}

export function isEligibleForSlot(
  slot: string,
  positions: string[],
  manualMappings: Record<string, string[]> = {},
): boolean {
  const normalizedSlot = normalize(slot);
  const allowed =
    manualMappings[normalizedSlot]?.map(normalize) ??
    DEFAULT_SLOT_ELIGIBILITY[normalizedSlot];
  if (!allowed) return false;
  const positionSet = new Set(positions.map(normalize));
  return allowed.some((position) => positionSet.has(position));
}

function solve(
  slots: { slot: string; originalIndex: number }[],
  players: LineupCandidate[],
  strategy: LineupStrategy,
  manualMappings: Record<string, string[]>,
  blocked: Set<string>,
  diagnostics: string[],
): Omit<LineupSolution, "alternatives" | "excludedPlayerIds" | "diagnostics"> {
  const assignments: LineupAssignment[] = [];
  const lockedPlayers = new Set<string>();
  const openSlots = new Set(slots.map((slot) => slot.originalIndex));
  for (const player of players) {
    if (!player.gameStarted && player.lockedSlotIndex === undefined) continue;
    if (player.lockedSlotIndex === undefined) {
      diagnostics.push(
        `${player.name} has started but no locked slot was supplied.`,
      );
      continue;
    }
    const slot = slots.find(
      ({ originalIndex }) => originalIndex === player.lockedSlotIndex,
    );
    if (!slot) {
      diagnostics.push(
        `${player.name} references unavailable locked slot ${player.lockedSlotIndex}.`,
      );
      continue;
    }
    if (
      !isEligibleForSlot(slot.slot, player.eligiblePositions, manualMappings)
    ) {
      diagnostics.push(
        `${player.name} is not eligible for locked slot ${slot.slot}.`,
      );
      continue;
    }
    if (
      !openSlots.has(slot.originalIndex) ||
      lockedPlayers.has(player.playerId)
    ) {
      diagnostics.push(
        `Duplicate locked assignment was rejected for ${player.name}.`,
      );
      continue;
    }
    assignments.push({
      slotIndex: slot.originalIndex,
      slot: slot.slot,
      playerId: player.playerId,
      score: objective(player, strategy),
      locked: true,
    });
    lockedPlayers.add(player.playerId);
    openSlots.delete(slot.originalIndex);
  }

  const remainingSlots = slots.filter((slot) =>
    openSlots.has(slot.originalIndex),
  );
  const remainingPlayers = players.filter(
    (player) => !lockedPlayers.has(player.playerId),
  );
  const matched = minCostMaximumMatching(
    remainingSlots,
    remainingPlayers,
    strategy,
    manualMappings,
    blocked,
  );
  assignments.push(...matched);
  for (const slot of remainingSlots) {
    if (
      !matched.some((assignment) => assignment.slotIndex === slot.originalIndex)
    ) {
      assignments.push({
        slotIndex: slot.originalIndex,
        slot: slot.slot,
        playerId: null,
        score: 0,
        locked: false,
      });
    }
  }
  assignments.sort((left, right) => left.slotIndex - right.slotIndex);
  return {
    score: round(
      assignments.reduce((sum, assignment) => sum + assignment.score, 0),
    ),
    assignments,
    emptySlots: assignments
      .filter((assignment) => assignment.playerId === null)
      .map((assignment) => assignment.slotIndex),
  };
}

type Edge = { to: number; reverse: number; capacity: number; cost: number };

function minCostMaximumMatching(
  slots: { slot: string; originalIndex: number }[],
  players: LineupCandidate[],
  strategy: LineupStrategy,
  manualMappings: Record<string, string[]>,
  blocked: Set<string>,
): LineupAssignment[] {
  const source = 0;
  const slotOffset = 1;
  const playerOffset = slotOffset + slots.length;
  const sink = playerOffset + players.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const edgesAt = (node: number): Edge[] => {
    const edges = graph[node];
    if (!edges) throw new Error(`Matching graph node ${node} does not exist.`);
    return edges;
  };
  const addEdge = (
    from: number,
    to: number,
    capacity: number,
    cost: number,
  ) => {
    const fromEdges = edgesAt(from);
    const toEdges = edgesAt(to);
    const forward: Edge = { to, reverse: toEdges.length, capacity, cost };
    const reverse: Edge = {
      to: from,
      reverse: fromEdges.length,
      capacity: 0,
      cost: -cost,
    };
    fromEdges.push(forward);
    toEdges.push(reverse);
  };
  slots.forEach((_, index) => addEdge(source, slotOffset + index, 1, 0));
  players.forEach((_, index) => addEdge(playerOffset + index, sink, 1, 0));
  slots.forEach((slot, slotIndex) => {
    players.forEach((player, playerIndex) => {
      if (blocked.has(`${slot.originalIndex}:${player.playerId}`)) return;
      if (
        !isEligibleForSlot(slot.slot, player.eligiblePositions, manualMappings)
      )
        return;
      const score = objective(player, strategy);
      const deterministicTie = playerIndex + slotIndex / 1000;
      addEdge(
        slotOffset + slotIndex,
        playerOffset + playerIndex,
        1,
        Math.round(-score * 1_000_000 + deterministicTie),
      );
    });
  });

  for (;;) {
    const distance = Array<number>(graph.length).fill(Number.POSITIVE_INFINITY);
    const previousNode = Array<number>(graph.length).fill(-1);
    const previousEdge = Array<number>(graph.length).fill(-1);
    distance[source] = 0;
    for (let iteration = 0; iteration < graph.length - 1; iteration += 1) {
      let changed = false;
      for (let node = 0; node < graph.length; node += 1) {
        const currentDistance = distance[node];
        if (currentDistance === undefined || !Number.isFinite(currentDistance))
          continue;
        for (const [edgeIndex, edge] of edgesAt(node).entries()) {
          if (edge.capacity <= 0) continue;
          const candidate = currentDistance + edge.cost;
          const targetDistance = distance[edge.to] ?? Number.POSITIVE_INFINITY;
          if (candidate < targetDistance) {
            distance[edge.to] = candidate;
            previousNode[edge.to] = node;
            previousEdge[edge.to] = edgeIndex;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    if (previousNode[sink] === -1) break;
    let node = sink;
    while (node !== source) {
      const from = previousNode[node];
      const edgeIndex = previousEdge[node];
      if (
        from === undefined ||
        from < 0 ||
        edgeIndex === undefined ||
        edgeIndex < 0
      ) {
        throw new Error("Matching path reconstruction failed.");
      }
      const edge = edgesAt(from)[edgeIndex];
      if (!edge) throw new Error("Matching path edge does not exist.");
      edge.capacity -= 1;
      const reverse = edgesAt(node)[edge.reverse];
      if (!reverse) throw new Error("Matching reverse edge does not exist.");
      reverse.capacity += 1;
      node = from;
    }
  }

  const assignments: LineupAssignment[] = [];
  slots.forEach((slot, slotIndex) => {
    for (const edge of edgesAt(slotOffset + slotIndex)) {
      if (edge.to < playerOffset || edge.to >= sink || edge.capacity !== 0)
        continue;
      const player = players[edge.to - playerOffset];
      if (!player) continue;
      assignments.push({
        slotIndex: slot.originalIndex,
        slot: slot.slot,
        playerId: player.playerId,
        score: objective(player, strategy),
        locked: false,
      });
      break;
    }
  });
  return assignments;
}

function objective(player: LineupCandidate, strategy: LineupStrategy): number {
  const availability = clamp(player.availabilityProbability ?? 1, 0, 1);
  const base =
    strategy === "floor"
      ? player.floor * 0.7 + player.expectedPoints * 0.3
      : strategy === "ceiling"
        ? player.ceiling * 0.65 + player.expectedPoints * 0.35
        : player.expectedPoints * 0.7 +
          player.floor * 0.15 +
          player.ceiling * 0.15;
  return round(base * availability);
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
