import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";

import "./score-breakdown.css";

/**
 * Structural on purpose. Two engines produce addends — the valuation engine
 * behind the draft board (`ScoreComponent`) and the deterministic decision
 * engine (`ScoreFactor`) — and both feed this table.
 */
export type ScoreBreakdownFactor = {
  key: string;
  label: string;
  impact: number;
  note: string;
};

export type ScoreBreakdownProps = {
  factors: ScoreBreakdownFactor[];
  /** The deterministic total before any research overlay. */
  localScore: number;
  /** Signed research adjustment, if an overlay has been applied. */
  researchAdjustment?: number;
  /** Bound the overlay was allowed to move the score within. */
  researchBound?: number;
  /** How many sources the overlay cited. */
  sourceCount?: number;
};

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

/**
 * Shows how a score was built rather than asserting it.
 *
 * Two colours carry the trust model and must not be blended: teal is
 * deterministic and always available offline, violet is research-adjusted.
 * The research row is never rendered without the local figure beside it.
 */
export function ScoreBreakdown({
  factors,
  localScore,
  researchAdjustment,
  researchBound,
  sourceCount,
}: ScoreBreakdownProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const hasResearch = researchAdjustment !== undefined;
  const contextual = localScore + (researchAdjustment ?? 0);

  return (
    <section className="score-breakdown">
      <button
        type="button"
        className="score-breakdown-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight aria-hidden="true" data-open={open} />
        <span>How this score was built</span>
        <small>
          {factors.length} factor{factors.length === 1 ? "" : "s"}
          {hasResearch ? " + research" : ""}
        </small>
      </button>

      {open ? (
        <table className="score-breakdown-table" id={panelId}>
          <caption className="sr-only">
            Factor contributions to the contextual score
          </caption>
          <thead>
            <tr>
              <th scope="col">Factor</th>
              <th scope="col">Impact</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((factor) => (
              <tr key={factor.key}>
                <th scope="row">
                  <strong>{factor.label}</strong>
                  <small>{factor.note}</small>
                </th>
                <td className="tabular">
                  {factor.key === "base"
                    ? factor.impact.toFixed(1)
                    : signed(factor.impact)}
                </td>
              </tr>
            ))}
            {hasResearch ? (
              <tr className="score-breakdown-research">
                <th scope="row">
                  <strong>Research adjustment</strong>
                  <small>
                    {sourceCount === undefined
                      ? "Bounded overlay"
                      : `${sourceCount} source${sourceCount === 1 ? "" : "s"}`}
                    {researchBound === undefined
                      ? ""
                      : ` · bounded ±${researchBound.toFixed(1)}`}
                  </small>
                </th>
                <td className="tabular">{signed(researchAdjustment)}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Contextual</th>
              <td className="tabular">{contextual.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      ) : null}
    </section>
  );
}
