import type { Player } from "@/types/domain";

export type TeamRosterRow = {
  slot: string;
  playerId: string | null;
  player: Player | null;
};

export type TeamRosterSection = {
  key: "starters" | "roster" | "bench" | "taxi" | "reserve";
  title: string;
  rows: TeamRosterRow[];
};

export type TeamRosterInput = {
  rosterPositions: readonly string[];
  playerIds: readonly string[];
  starterIds: readonly string[];
  reserveIds?: readonly string[];
  taxiIds?: readonly string[];
  players: readonly Player[];
  rosterOnly?: boolean;
};

const NON_STARTING_SLOTS = new Set(["BN", "BENCH", "IR", "RESERVE", "TAXI"]);

/**
 * Reconstructs Sleeper's roster sections without changing source order.
 * Reserved players cannot leak into starters or the bench, and each real
 * player ID appears at most once even when a malformed payload repeats it.
 */
export function buildTeamRosterSections(
  input: TeamRosterInput,
): TeamRosterSection[] {
  const playerById = new Map<string, Player>();
  for (const player of input.players) {
    playerById.set(player.id, player);
    if (player.sleeperId) playerById.set(player.sleeperId, player);
  }

  const reserveIds = uniqueIds(input.reserveIds ?? []);
  const taxiIds = uniqueIds(input.taxiIds ?? []);
  const separatedIds = new Set([...reserveIds, ...taxiIds]);
  const seen = new Set<string>();

  const rowFor = (
    slot: string,
    sourceId: string | undefined,
  ): TeamRosterRow => {
    const playerId = validId(sourceId);
    if (!playerId || seen.has(playerId) || separatedIds.has(playerId)) {
      return { slot, playerId: null, player: null };
    }
    seen.add(playerId);
    return { slot, playerId, player: playerById.get(playerId) ?? null };
  };

  if (input.rosterOnly) {
    return [
      {
        key: "roster",
        title: "Roster",
        rows: uniqueIds(input.playerIds).map((playerId) => ({
          slot: "BN",
          playerId,
          player: playerById.get(playerId) ?? null,
        })),
      },
    ];
  }

  const starterSlots = input.rosterPositions.filter(
    (slot) => !NON_STARTING_SLOTS.has(slot.toUpperCase()),
  );
  if (starterSlots.length === 0) {
    return [
      {
        key: "roster",
        title: "Roster",
        rows: uniqueIds(input.playerIds).map((playerId) => ({
          slot: "BN",
          playerId,
          player: playerById.get(playerId) ?? null,
        })),
      },
    ];
  }

  const sections: TeamRosterSection[] = [
    {
      key: "starters",
      title: "Starters",
      rows: starterSlots.map((slot, index) =>
        rowFor(slot, input.starterIds[index]),
      ),
    },
  ];

  const starterIds = new Set(seen);
  const benchRows = uniqueIds(input.playerIds)
    .filter(
      (playerId) => !starterIds.has(playerId) && !separatedIds.has(playerId),
    )
    .map((playerId) => {
      seen.add(playerId);
      return { slot: "BN", playerId, player: playerById.get(playerId) ?? null };
    });
  const benchSlotCount = input.rosterPositions.filter((slot) =>
    ["BN", "BENCH"].includes(slot.toUpperCase()),
  ).length;
  const paddedBenchRows = padOpenRows(benchRows, benchSlotCount, "BN");
  if (paddedBenchRows.length) {
    sections.push({ key: "bench", title: "Bench", rows: paddedBenchRows });
  }

  const taxiRows = taxiIds
    .filter((playerId) => !seen.has(playerId))
    .map((playerId) => {
      seen.add(playerId);
      return {
        slot: "TAXI",
        playerId,
        player: playerById.get(playerId) ?? null,
      };
    });
  const taxiSlotCount = input.rosterPositions.filter(
    (slot) => slot.toUpperCase() === "TAXI",
  ).length;
  const paddedTaxiRows = padOpenRows(taxiRows, taxiSlotCount, "TAXI");
  if (paddedTaxiRows.length) {
    sections.push({ key: "taxi", title: "Taxi Squad", rows: paddedTaxiRows });
  }

  const reserveRows = reserveIds
    .filter((playerId) => !seen.has(playerId))
    .map((playerId) => {
      seen.add(playerId);
      return { slot: "IR", playerId, player: playerById.get(playerId) ?? null };
    });
  const reserveSlotCount = input.rosterPositions.filter((slot) =>
    ["IR", "RESERVE"].includes(slot.toUpperCase()),
  ).length;
  const paddedReserveRows = padOpenRows(reserveRows, reserveSlotCount, "IR");
  if (paddedReserveRows.length) {
    sections.push({
      key: "reserve",
      title: "Reserve",
      rows: paddedReserveRows,
    });
  }

  return sections;
}

function validIds(ids: readonly string[]): string[] {
  return ids.flatMap((id) => {
    const value = validId(id);
    return value ? [value] : [];
  });
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(validIds(ids))];
}

function padOpenRows(
  rows: TeamRosterRow[],
  configuredCount: number,
  slot: string,
): TeamRosterRow[] {
  const openCount = Math.max(0, configuredCount - rows.length);
  return [
    ...rows,
    ...Array.from({ length: openCount }, (): TeamRosterRow => ({
      slot,
      playerId: null,
      player: null,
    })),
  ];
}

function validId(id: string | undefined): string | null {
  if (!id) return null;
  const value = id.trim();
  return value && value !== "0" ? value : null;
}
