import type { Player } from "@/types/domain";

export type IdentityCandidate = {
  player: Player;
  score: number;
  evidence: string[];
};

export type IdentityInput = {
  sleeperId?: string;
  fullName: string;
  team?: string;
  position?: string;
  birthDate?: string;
  college?: string;
  nflDraftYear?: number;
};

export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/\b(?:jr|sr|ii|iii|iv)\b\.?/g, "")
    .replaceAll(/[^a-z0-9]/g, "");
}

export function matchPlayerIdentity(
  input: IdentityInput,
  players: Player[],
): IdentityCandidate[] {
  const normalized = normalizePlayerName(input.fullName);
  return players
    .map((player) => {
      let score = 0;
      const evidence: string[] = [];
      if (input.sleeperId && input.sleeperId === player.sleeperId) {
        score += 1;
        evidence.push("Exact Sleeper ID");
      }
      if (normalized === player.normalizedName) {
        score += 0.5;
        evidence.push("Exact normalized name");
      }
      if (input.position && input.position === player.position) {
        score += 0.18;
        evidence.push("Position match");
      }
      if (input.team && input.team === player.team) {
        score += 0.14;
        evidence.push("Team match");
      }
      if (input.college && input.college === player.college) {
        score += 0.1;
        evidence.push("College match");
      }
      if (input.nflDraftYear && input.nflDraftYear === player.nflDraftYear) {
        score += 0.12;
        evidence.push("NFL draft year match");
      }
      return { player, score: Math.min(1, score), evidence };
    })
    .filter((candidate) => candidate.score >= 0.4)
    .toSorted((a, b) => b.score - a.score);
}

export function isIdentityMatchCertain(
  candidates: IdentityCandidate[],
): boolean {
  const top = candidates[0];
  const next = candidates[1];
  if (!top || top.score < 0.75) return false;
  return !next || top.score - next.score >= 0.2;
}
