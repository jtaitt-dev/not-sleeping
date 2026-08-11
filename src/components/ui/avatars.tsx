import { useState } from "react";

import "./avatars.css";

type AvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: "small" | "medium" | "large";
  className?: string;
};

function SleeperEntityAvatar({
  kind,
  name,
  imageUrl,
  size = "medium",
  className = "",
}: AvatarProps & { kind: "league" | "team" }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const visibleImage = imageUrl && imageUrl !== failedImage ? imageUrl : null;
  return (
    <span
      className={`entity-avatar entity-avatar--${kind} entity-avatar--${size} ${visibleImage ? "has-image" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      {visibleImage ? (
        <img
          src={visibleImage}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedImage(visibleImage)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function SleeperLeagueAvatar(props: AvatarProps) {
  return <SleeperEntityAvatar {...props} kind="league" />;
}

export function SleeperTeamAvatar(props: AvatarProps) {
  return <SleeperEntityAvatar {...props} kind="team" />;
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
