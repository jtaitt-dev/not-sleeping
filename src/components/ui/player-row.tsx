import type { ReactNode } from "react";

import type { Player } from "@/types/domain";

import { PositionBadge } from "./badges";
import { PlayerAvatar } from "./player-avatar";
import "./player-row.css";

export function SleeperPlayerIdentity({
  player,
  meta,
  trailing,
  size = "small",
  className = "",
}: {
  player: Player;
  meta?: ReactNode;
  trailing?: ReactNode;
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  return (
    <span className={`sleeper-player-identity ${className}`.trim()}>
      <PlayerAvatar player={player} size={size} />
      <span className="sleeper-player-identity__copy">
        <strong>{player.fullName}</strong>
        <small>{meta ?? `${player.team ?? "FA"} · ${player.position}`}</small>
      </span>
      <PositionBadge position={player.position} />
      {trailing ? (
        <span className="sleeper-player-identity__trailing">{trailing}</span>
      ) : null}
    </span>
  );
}
