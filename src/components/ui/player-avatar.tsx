import { useMemo, useState } from "react";

import {
  markPlayerHeadshotFailed,
  resolvePlayerHeadshot,
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
  const resolved = useMemo(
    () => resolvePlayerHeadshot(player, size === "large" ? "full" : "thumb"),
    [player, size],
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = resolved === failedUrl ? null : resolved;
  const initials = `${player.firstName.at(0) ?? ""}${player.lastName.at(0) ?? ""}`;
  return (
    <span
      className={`player-avatar player-avatar--${size} ${imageUrl ? "has-image" : "is-fallback"}`}
      aria-hidden="true"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={() => {
            markPlayerHeadshotFailed(imageUrl);
            setFailedUrl(imageUrl);
          }}
        />
      ) : player.position === "DEF" ? (
        (player.team ?? "DEF")
      ) : (
        initials
      )}
    </span>
  );
}
