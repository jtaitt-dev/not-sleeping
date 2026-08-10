import type { SleeperDraft, SleeperTradedPick } from "@/schemas/sleeper";
import { detectDraftStyle } from "@/config/sleeper-capabilities";
import type { LiveDraftStyle } from "@/types/domain";

export function draftSlotForPick(
  pickNumber: number,
  teams: number,
  style: LiveDraftStyle,
): number {
  const safeTeams = Math.max(1, Math.floor(teams));
  const round = Math.max(1, Math.ceil(pickNumber / safeTeams));
  const inRound = ((Math.max(1, pickNumber) - 1) % safeTeams) + 1;
  if (style === "linear" || style === "auction" || style === "manual_custom") {
    return inRound;
  }
  if (style === "third_round_reversal") {
    if (round === 1) return inRound;
    if (round === 2 || round === 3) return safeTeams - inRound + 1;
    return round % 2 === 0 ? inRound : safeTeams - inRound + 1;
  }
  return round % 2 === 0 ? safeTeams - inRound + 1 : inRound;
}

export function ownedDraftPicks(input: {
  draft: SleeperDraft;
  tradedPicks?: SleeperTradedPick[];
  teams: number;
  rounds: number;
  userId?: string;
  rosterId?: number;
}): { style: LiveDraftStyle; picks: number[] } {
  const style = detectDraftStyle(input.draft);
  if (!input.userId && input.rosterId === undefined)
    return { style, picks: [] };
  const userSlot = input.userId
    ? input.draft.draft_order?.[input.userId]
    : undefined;
  // The draft's slot mapping is authoritative for ownership. League-derived
  // mocks can assign synthetic roster IDs that differ from the source
  // league's roster ID (for example, league roster 8 drafting from slot 10).
  const userRosterId =
    (userSlot === undefined
      ? undefined
      : input.draft.slot_to_roster_id?.[String(userSlot)]) ?? input.rosterId;
  const rosterByOriginalSlot = new Map<number, number>();
  for (const [slot, rosterId] of Object.entries(
    input.draft.slot_to_roster_id ?? {},
  )) {
    const numericSlot = Number(slot);
    if (Number.isInteger(numericSlot))
      rosterByOriginalSlot.set(numericSlot, rosterId);
  }
  const picks: number[] = [];
  for (
    let pickNumber = 1;
    pickNumber <= input.teams * input.rounds;
    pickNumber += 1
  ) {
    const round = Math.ceil(pickNumber / input.teams);
    const originalSlot = draftSlotForPick(pickNumber, input.teams, style);
    const originalRosterId = rosterByOriginalSlot.get(originalSlot);
    const trade = input.tradedPicks?.find(
      (candidate) =>
        candidate.season === input.draft.season &&
        candidate.round === round &&
        candidate.roster_id === originalRosterId,
    );
    const ownerRosterId = trade?.owner_id ?? originalRosterId;
    const owned =
      userRosterId !== undefined
        ? ownerRosterId === userRosterId
        : originalSlot === userSlot;
    if (owned) picks.push(pickNumber);
  }
  return { style, picks };
}

export function nextOwnedPick(
  ownedPicks: number[],
  currentPick: number,
): number | undefined {
  return ownedPicks.find((pick) => pick >= currentPick);
}
