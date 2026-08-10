import { isPlayerEligibleForAnyRosterSlot } from "@/services/roster/position-eligibility";
import type { Player } from "@/types/domain";
import type { DraftPlayerPool } from "@/types/league";

export type PlayerPoolQuery = {
  playerPool?: DraftPlayerPool;
  rosterSlots?: readonly string[];
  excludePlayerIds?: readonly string[];
  rookiesOnly?: boolean;
  idpOnly?: boolean;
};

const IDP_POSITIONS = new Set([
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
]);

/**
 * Compile the league constraints before applying a result limit. Applying the
 * limit first lets unrelated positions crowd valid players out of long drafts.
 */
export function createPlayerPoolPredicate(
  query: PlayerPoolQuery,
): (player: Player) => boolean {
  const excluded = new Set(query.excludePlayerIds ?? []);
  const pool =
    query.playerPool ?? (query.rookiesOnly ? "rookies_only" : "all_available");
  const rosterSlots = query.rosterSlots ?? [];

  return (player) => {
    if (excluded.has(player.id)) return false;
    if (pool === "rookies_only" && player.yearsExperience !== 0) return false;
    if (pool === "veterans_only" && player.yearsExperience === 0) return false;

    const positions =
      player.fantasyPositions.length > 0
        ? player.fantasyPositions
        : [player.position];
    if (
      query.idpOnly &&
      !positions.some((position) => IDP_POSITIONS.has(position))
    ) {
      return false;
    }
    return (
      rosterSlots.length === 0 ||
      isPlayerEligibleForAnyRosterSlot(rosterSlots, positions)
    );
  };
}
