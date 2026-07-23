import type { Position } from "@/types/domain";

import "./badges.css";

export function PositionBadge({ position }: { position: Position }) {
  return (
    <span
      className="position-badge"
      data-position={position.toLowerCase()}
      aria-label={`Position ${position}`}
    >
      {position}
    </span>
  );
}

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span className={`status-badge status-badge--${tone}`}>{children}</span>
  );
}

export function TierBadge({ tier }: { tier: number }) {
  return <span className="tier-badge">Tier {tier}</span>;
}
