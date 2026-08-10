import type { SleeperDraft, SleeperTradedPick } from "@/schemas/sleeper";

/**
 * League-derived mocks can render source-league trades even when Sleeper's
 * draft-scoped traded-picks endpoint is empty. Merge both sources and let a
 * draft-scoped record win when Sleeper supplies one.
 */
export function resolveLiveDraftTradedPicks(input: {
  draft: SleeperDraft;
  draftTradedPicks?: SleeperTradedPick[] | null;
  leagueTradedPicks?: SleeperTradedPick[] | null;
}): SleeperTradedPick[] {
  const byOriginalPick = new Map<string, SleeperTradedPick>();
  for (const pick of [
    ...(input.leagueTradedPicks ?? []),
    ...(input.draftTradedPicks ?? []),
  ]) {
    if (pick.season !== input.draft.season) continue;
    byOriginalPick.set(`${pick.season}:${pick.round}:${pick.roster_id}`, pick);
  }
  return [...byOriginalPick.values()].toSorted(
    (left, right) =>
      left.round - right.round || left.roster_id - right.roster_id,
  );
}
