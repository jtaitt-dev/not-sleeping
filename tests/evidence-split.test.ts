import { describe, expect, it } from "vitest";

import { isSourcedFact } from "@/features/season/full-season-workspaces";
import type { EvidenceItem } from "@/types/league";

type Nature = EvidenceItem["nature"];

/**
 * The sheet's whole purpose is that a reader can tell a reported fact from our
 * own estimate. That distinction lives entirely in this predicate, so every
 * member of the union has to land on a deliberate side — a new nature added
 * later must not default into "what we know".
 */
describe("evidence splits sourced fact from model inference", () => {
  const sourced: Nature[] = ["fact", "report"];
  const estimated: Nature[] = ["opinion", "projection", "inference"];

  it("treats published claims as established", () => {
    for (const nature of sourced) {
      expect(isSourcedFact(nature)).toBe(true);
    }
  });

  it("treats projections, opinions and inferences as estimates", () => {
    for (const nature of estimated) {
      expect(isSourcedFact(nature)).toBe(false);
    }
  });

  it("classifies every nature the type allows", () => {
    // Fails to compile if a nature is added to the union without being sorted.
    const exhaustive: Record<Nature, boolean> = {
      fact: true,
      report: true,
      opinion: false,
      projection: false,
      inference: false,
    };
    for (const [nature, expected] of Object.entries(exhaustive)) {
      expect(isSourcedFact(nature as Nature)).toBe(expected);
    }
  });
});
