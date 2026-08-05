import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FaabBand } from "@/features/season/full-season-workspaces";

type Faab = Parameters<typeof FaabBand>[0]["faab"];

const faab = (
  conservativeBid: number,
  expectedWinningBid: number,
  aggressiveBid: number,
  maximumRationalBid: number,
): Faab =>
  ({
    minimumBid: 0,
    conservativeBid,
    expectedWinningBid,
    aggressiveBid,
    maximumRationalBid,
    budgetAfterExpectedBid: 100 - expectedWinningBid,
    percentages: {
      conservative: conservativeBid,
      expected: expectedWinningBid,
      aggressive: aggressiveBid,
      maximum: maximumRationalBid,
    },
    opportunityCost: "",
  }) as Faab;

/**
 * The bar is the only thing carrying the spread now that the four figures are
 * gone, so its geometry has to be right: the shaded band must cover exactly
 * conservative-to-aggressive and the tick must land on the bid being asked for.
 */
describe("the faab range bar places its band and tick", () => {
  it("shows the expected winning bid as the one number to act on", () => {
    const { container } = render(<FaabBand faab={faab(10, 18, 24, 40)} />);
    expect(container.querySelector(".faab-bid strong")?.textContent).toBe(
      "$18",
    );
    // The aggressive bid is part of the track, never a headline figure.
    expect(container.querySelectorAll("strong")).toHaveLength(1);
  });

  it("spans the band from conservative to aggressive", () => {
    const { container } = render(<FaabBand faab={faab(10, 18, 24, 50)} />);
    const band = container.querySelector<HTMLElement>(".faab-reasonable");
    // Track runs 10..50, so conservative sits at 0% and aggressive at 35% —
    // an inset of 65% from the right, which is how the browser stores it.
    expect(band?.style.left).toBe("0%");
    expect(band?.style.right).toBe("calc(65%)");
  });

  it("puts the tick on the expected bid", () => {
    const { container } = render(<FaabBand faab={faab(0, 25, 40, 50)} />);
    const tick = container.querySelector<HTMLElement>(".faab-tick");
    expect(tick?.style.left).toBe("50%");
  });

  it("survives a degenerate range without producing a negative band", () => {
    const { container } = render(<FaabBand faab={faab(7, 7, 7, 7)} />);
    const band = container.querySelector<HTMLElement>(".faab-reasonable");
    // Collapses to zero width rather than inverting.
    expect(band?.style.left).toBe("0%");
    expect(band?.style.right).toBe("calc(100%)");
  });

  it("describes the spread for a reader who cannot see the bar", () => {
    const { container } = render(<FaabBand faab={faab(10, 18, 24, 40)} />);
    expect(
      container.querySelector(".faab-range")?.getAttribute("aria-label"),
    ).toBe(
      "Reasonable between $10 and $24; $40 is the most this player is worth.",
    );
  });
});
