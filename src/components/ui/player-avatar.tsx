import type { Player } from "@/types/domain";

import "./player-avatar.css";

export function PlayerAvatar({
  player,
  size = "medium",
}: {
  player: Player;
  size?: "small" | "medium" | "large";
}) {
  const initials = `${player.firstName.at(0) ?? ""}${player.lastName.at(0) ?? ""}`;
  return (
    <span
      className={`player-avatar player-avatar--${size}`}
      aria-label={`${player.fullName} avatar`}
    >
      {initials}
    </span>
  );
}
