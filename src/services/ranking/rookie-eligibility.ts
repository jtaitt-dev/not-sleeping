import type { Player } from "@/types/domain";

export type RookieOverride = "include" | "exclude" | null;

export type RookieResolution = {
  eligible: boolean;
  confidence: number;
  explanation: string;
  ambiguous: boolean;
};

export function resolveRookieEligibility(
  player: Player,
  season: number,
  override: RookieOverride = null,
): RookieResolution {
  if (override) {
    return {
      eligible: override === "include",
      confidence: 1,
      explanation: `Manual ${override} override.`,
      ambiguous: false,
    };
  }
  if (player.yearsExperience === 0) {
    return {
      eligible: true,
      confidence: 0.98,
      explanation: "Sleeper reports zero years of NFL experience.",
      ambiguous: false,
    };
  }
  if (player.nflDraftYear === season) {
    return {
      eligible: true,
      confidence: 0.96,
      explanation: `NFL draft year matches the ${season} season.`,
      ambiguous: false,
    };
  }
  if (
    player.yearsExperience === undefined &&
    player.nflDraftYear === undefined
  ) {
    return {
      eligible: false,
      confidence: 0.2,
      explanation: "Experience and NFL draft year are unavailable.",
      ambiguous: true,
    };
  }
  return {
    eligible: false,
    confidence: 0.92,
    explanation: "Experience or draft-year evidence indicates veteran status.",
    ambiguous: false,
  };
}
