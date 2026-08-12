import type { ReactNode } from "react";

import type { Player } from "@/types/domain";

import { PlayerAvatar } from "./player-avatar";
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
  const normalizedSlot = normalizeSlot(slot);
  return (
    <div className="sleeper-roster-slot" role="listitem">
      <span
        className="sleeper-roster-slot__label"
        data-slot={normalizedSlot}
        aria-label={`Slot ${accessibleSlotName(normalizedSlot)}`}
      >
        {normalizedSlot}
      </span>
      {player ? (
        <PlayerAvatar player={player} size="roster" />
      ) : (
        <span
          className="sleeper-roster-slot__avatar-placeholder"
          aria-hidden="true"
        />
      )}
      <span className="sleeper-roster-slot__copy">
        <strong>{player?.fullName ?? emptyTitle}</strong>
        <small>
          {player ? (meta ?? defaultPlayerMeta(player)) : emptyDetail}
        </small>
      </span>
      <b className="sleeper-roster-slot__value tabular">{value ?? "—"}</b>
    </div>
  );
}

function normalizeSlot(slot: ReactNode): string {
  if (typeof slot !== "string") return "FLEX";
  const value = slot.trim().toUpperCase();
  if (["SUPER_FLEX", "SUPERFLEX", "SF"].includes(value)) return "SF";
  if (["WRRB_FLEX", "REC_FLEX", "FLEX"].includes(value)) return "FLEX";
  if (value === "IDP_FLEX") return "IDP";
  if (["BN", "BENCH"].includes(value)) return "BN";
  if (["IR", "RESERVE", "RES"].includes(value)) return "IR";
  if (value === "TAXI") return "TAXI";
  if (["DST", "D/ST"].includes(value)) return "DEF";
  if (["DE", "DT", "EDGE"].includes(value)) return "DL";
  if (["ILB", "OLB"].includes(value)) return "LB";
  if (["CB", "S", "FS", "SS"].includes(value)) return "DB";
  return value || "FLEX";
}

function accessibleSlotName(slot: string): string {
  if (slot === "SF") return "superflex";
  if (slot === "BN") return "bench";
  if (slot === "IR") return "reserve";
  if (slot === "IDP") return "IDP flex";
  return slot.toLowerCase();
}

function defaultPlayerMeta(player: Player): string {
  return [player.team ?? "FA", player.position, player.injuryStatus]
    .filter(Boolean)
    .join(" · ");
}
