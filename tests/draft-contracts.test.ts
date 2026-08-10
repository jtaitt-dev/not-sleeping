import { describe, expect, it } from "vitest";

import { translateDraftError } from "@/services/draft/draft-errors";
import {
  calibrateDraftScore,
  normalizeScarcityForDecision,
} from "@/services/draft/recommendation-contract";
import { safeRuntimeError } from "@/services/messaging/runtime-client";

describe("draft presentation and safety contracts", () => {
  it("normalizes the ranking scarcity range exactly once at the protocol boundary", () => {
    expect(normalizeScarcityForDecision(-3)).toBe(0);
    expect(normalizeScarcityForDecision(10)).toBe(1);
    expect(normalizeScarcityForDecision(3.5)).toBe(0.5);
  });

  it("keeps high raw scores ordered without saturating every display score", () => {
    const values = [90, 100, 110, 120].map(calibrateDraftScore);
    expect(values).toEqual(values.toSorted((left, right) => left - right));
    expect(new Set(values).size).toBe(values.length);
    expect(values.at(-1)).toBeLessThan(100);
  });

  it("never exposes arbitrary provider, Zod, JSON, or stack text", () => {
    const raw = new Error(
      "ZodError: expected number at candidates[0].scarcity\n at provider.ts:41",
    );
    const safe = safeRuntimeError(raw);
    const visible = translateDraftError(safe);
    expect(JSON.stringify({ safe, visible })).not.toContain("ZodError");
    expect(JSON.stringify({ safe, visible })).not.toContain("provider.ts");
    expect(visible.title).toContain("refresh");
  });
});
