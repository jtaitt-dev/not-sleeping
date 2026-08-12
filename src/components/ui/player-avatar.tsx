import { useMemo, useState } from "react";

import {
  hasPlayerHeadshotFailed,
  markPlayerHeadshotFailed,
  resolvePlayerHeadshotCandidates,
} from "@/services/players/player-headshots";
import type { Player } from "@/types/domain";

import "./player-avatar.css";

export function PlayerAvatar({
  player,
  size = "medium",
  priority = false,
}: {
  player: Player;
  size?: "small" | "medium" | "large";
  priority?: boolean;
}) {
  const candidates = useMemo(
    () =>
      resolvePlayerHeadshotCandidates(
        player,
        size === "large" ? "full" : "thumb",
      ),
    [player, size],
  );
  const [, setFailureVersion] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const imageUrl =
    candidates.find((url) => !hasPlayerHeadshotFailed(url)) ?? null;
  const initials = `${player.firstName.at(0) ?? ""}${player.lastName.at(0) ?? ""}`;
  const fallback =
    player.position === "DEF" ? (player.team ?? "DEF") : initials;
  return (
    <span
      className={`player-avatar player-avatar--${size} ${imageUrl ? "has-image" : "is-fallback"}`}
      aria-hidden="true"
    >
      <span className="player-avatar__fallback">{fallback}</span>
      {imageUrl ? (
        <img
          className={loadedUrl === imageUrl ? "is-loaded" : ""}
          src={imageUrl}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoadedUrl(imageUrl)}
          onError={() => {
            markPlayerHeadshotFailed(imageUrl);
            setLoadedUrl(null);
            setFailureVersion((current) => current + 1);
          }}
        />
      ) : null}
    </span>
  );
}
