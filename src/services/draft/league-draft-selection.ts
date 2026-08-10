import type { SleeperDraft, SleeperLeague } from "@/schemas/sleeper";

const statusPriority: Record<string, number> = {
  drafting: 0,
  paused: 1,
  pre_draft: 2,
  complete: 3,
};

/** Resolve the Sleeper draft board that belongs to one selected league. */
export function resolveLeagueDraftId(input: {
  league: SleeperLeague;
  drafts: SleeperDraft[];
}): string | null {
  const direct = cleanId(input.league.draft_id);
  if (direct) return direct;

  return (
    input.drafts
      .filter(
        (draft) =>
          draft.league_id === input.league.league_id &&
          draft.season === input.league.season,
      )
      .toSorted((left, right) => {
        const status =
          (statusPriority[left.status] ?? 99) -
          (statusPriority[right.status] ?? 99);
        if (status !== 0) return status;
        const recency = (right.start_time ?? 0) - (left.start_time ?? 0);
        return recency !== 0
          ? recency
          : right.draft_id.localeCompare(left.draft_id);
      })[0]?.draft_id ?? null
  );
}

function cleanId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
