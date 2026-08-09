const POSITION_ALIASES: Readonly<Record<string, string>> = {
  D: "DEF",
  DST: "DEF",
  NT: "DL",
};

export const OFFENSIVE_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export const IDP_POSITIONS = [
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
] as const;

const IDP_POSITION_SET = new Set<string>(IDP_POSITIONS);

export function normalizeSleeperPosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return POSITION_ALIASES[normalized] ?? normalized;
}

export function isIdpPosition(position: string): boolean {
  return IDP_POSITION_SET.has(normalizeSleeperPosition(position));
}

export function isPlayerEligibleForRosterSlot(
  slot: string,
  positions: readonly string[],
): boolean {
  const normalizedSlot = normalizeSleeperPosition(slot);
  const eligible = new Set(positions.map(normalizeSleeperPosition));

  if (["BN", "IR", "RESERVE", "TAXI"].includes(normalizedSlot)) return true;
  if (eligible.has(normalizedSlot)) return true;
  if (["FLEX", "WRRB_FLEX"].includes(normalizedSlot)) {
    return ["RB", "WR", "TE"].some((position) => eligible.has(position));
  }
  if (normalizedSlot === "REC_FLEX") {
    return ["WR", "TE"].some((position) => eligible.has(position));
  }
  if (normalizedSlot === "SUPER_FLEX") {
    return OFFENSIVE_POSITIONS.some((position) => eligible.has(position));
  }
  if (["IDP", "IDP_FLEX", "DEF_FLEX"].includes(normalizedSlot)) {
    return [...eligible].some(isIdpPosition);
  }
  if (normalizedSlot === "DL") {
    return ["DL", "DE", "DT", "EDGE"].some((position) =>
      eligible.has(position),
    );
  }
  if (normalizedSlot === "LB") {
    return ["LB", "ILB", "OLB", "EDGE"].some((position) =>
      eligible.has(position),
    );
  }
  if (normalizedSlot === "DB") {
    return ["DB", "CB", "S", "FS", "SS"].some((position) =>
      eligible.has(position),
    );
  }
  return false;
}

export function isPlayerEligibleForAnyRosterSlot(
  rosterSlots: readonly string[],
  positions: readonly string[],
): boolean {
  const constrainedSlots = rosterSlots.filter(
    (slot) =>
      !["BN", "IR", "RESERVE", "TAXI"].includes(normalizeSleeperPosition(slot)),
  );
  return (
    constrainedSlots.length === 0 ||
    constrainedSlots.some((slot) =>
      isPlayerEligibleForRosterSlot(slot, positions),
    )
  );
}
