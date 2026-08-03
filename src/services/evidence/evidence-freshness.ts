import { stableContentHash } from "@/services/research/request-queue";
import type { Player } from "@/types/domain";

export type EvidenceFingerprint = {
  key: string;
  playerId: string;
  newsUpdatedAt: number | null;
  team: string | null;
  status: string;
  injuryStatus: string | null;
};

export function playerEvidenceFingerprint(player: Player): EvidenceFingerprint {
  return {
    key: stableContentHash({
      id: player.id,
      newsUpdatedAt: player.newsUpdatedAt ?? null,
      team: player.team ?? null,
      status: player.status,
      injuryStatus: player.injuryStatus ?? null,
    }),
    playerId: player.id,
    newsUpdatedAt: player.newsUpdatedAt ?? null,
    team: player.team ?? null,
    status: player.status,
    injuryStatus: player.injuryStatus ?? null,
  };
}

export function evidenceChanged(
  previous: EvidenceFingerprint | null | undefined,
  current: EvidenceFingerprint,
): boolean {
  return previous?.key !== current.key;
}

export const SLEEPER_NEWS_LIMITATION =
  "Sleeper's documented public API exposes player metadata such as news_updated, but no documented article/news endpoint. Not Sleeping uses that metadata only as an invalidation signal and never invents article content.";
