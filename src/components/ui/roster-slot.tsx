import type { ReactNode } from "react";

import type { Player } from "@/types/domain";

import { PositionBadge } from "./badges";
import "./roster-slot.css";

export function SleeperRosterSlot({
  slot,
  player,
  meta,
  value,
  emptyTitle = "Open",
  emptyDetail = "No eligible player rostered",
}: {
  slot: ReactNode;
  player?: Player | null;
  meta?: ReactNode;
  value?: ReactNode;
  emptyTitle?: ReactNode;
  emptyDetail?: ReactNode;
}) {
  return (
    <div className="sleeper-roster-slot">
      <span className="sleeper-roster-slot__label">{slot}</span>
      <PositionBadge position={player?.position ?? normalizeSlot(slot)} />
      <span className="sleeper-roster-slot__copy">
        <strong>{player?.fullName ?? emptyTitle}</strong>
        <small>{player ? (meta ?? player.team ?? "FA") : emptyDetail}</small>
      </span>
      <b className="sleeper-roster-slot__value tabular">{value ?? "—"}</b>
    </div>
  );
}

function normalizeSlot(slot: ReactNode): Player["position"] {
  if (typeof slot !== "string") return "FLEX";
  if (["QB", "RB", "WR", "TE", "K", "DEF"].includes(slot)) {
    return slot as Player["position"];
  }
  return "FLEX";
}
