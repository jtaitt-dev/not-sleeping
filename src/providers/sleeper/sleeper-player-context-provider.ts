import { db } from "@/services/cache/database";
import {
  playerEvidenceFingerprint,
  SLEEPER_NEWS_LIMITATION,
} from "@/services/evidence/evidence-freshness";

import { SleeperProvider } from "./sleeper-provider";

export type SleeperPlayerContext = {
  playerId: string;
  playerName: string;
  team: string | null;
  status: string;
  injuryStatus: string | null;
  newsUpdatedAt: number | null;
  retrievedAt: number;
  fingerprint: string;
  source: {
    provider: "Sleeper";
    endpoint: "/v1/players/nfl";
    nature: "documented_player_metadata";
  };
  limitations: string[];
};

export class SleeperPlayerContextProvider {
  constructor(
    private readonly sleeper: SleeperProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async get(
    playerId: string,
    forceRefresh = false,
  ): Promise<SleeperPlayerContext | null> {
    await this.sleeper.refreshPlayers(forceRefresh);
    const player = await db.players.get(playerId);
    if (!player) return null;
    const fingerprint = playerEvidenceFingerprint(player);
    return {
      playerId: player.id,
      playerName: player.fullName,
      team: player.team ?? null,
      status: player.status,
      injuryStatus: player.injuryStatus ?? null,
      newsUpdatedAt: player.newsUpdatedAt ?? null,
      retrievedAt: this.now(),
      fingerprint: fingerprint.key,
      source: {
        provider: "Sleeper",
        endpoint: "/v1/players/nfl",
        nature: "documented_player_metadata",
      },
      limitations: [SLEEPER_NEWS_LIMITATION],
    };
  }
}
