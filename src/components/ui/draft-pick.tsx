import type { ReactNode } from "react";

import type { Position } from "@/types/domain";

import { PositionBadge } from "./badges";
import "./draft-pick.css";

export function SleeperDraftPick({
  pick,
  playerName,
  position,
  meta,
  status,
  active = false,
  className = "",
}: {
  pick: ReactNode;
  playerName: ReactNode;
  position?: Position;
  meta?: ReactNode;
  status?: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`sleeper-draft-pick ${active ? "is-active" : ""} ${className}`.trim()}
    >
      <span className="sleeper-draft-pick__number tabular">{pick}</span>
      <strong>{playerName}</strong>
      <span className="sleeper-draft-pick__meta">
        {position ? <PositionBadge position={position} /> : null}
        {meta ? <small>{meta}</small> : null}
      </span>
      {status ? (
        <span className="sleeper-draft-pick__status">{status}</span>
      ) : null}
    </article>
  );
}
