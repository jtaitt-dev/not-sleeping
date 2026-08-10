import { describe, expect, it } from "vitest";

import {
  draftAiProgressLabel,
  draftAiStatusLabel,
  settleWithin,
} from "@/features/draft/draft-copilot-card";

describe("Draft Copilot AI presentation states", () => {
  it("labels off, local, working, ready, error, and stale states truthfully", () => {
    expect(draftAiStatusLabel(false, undefined, "local_ready")).toBe("AI off");
    expect(draftAiStatusLabel(true, undefined, "local_ready")).toContain(
      "Local ready",
    );
    expect(draftAiStatusLabel(true, undefined, "checking_context")).toBe(
      "AI working",
    );
    expect(draftAiStatusLabel(true, "queued", "synthesizing")).toBe(
      "AI working",
    );
    expect(draftAiStatusLabel(true, "ready", "ready")).toBe("AI ready");
    expect(draftAiStatusLabel(true, "error", "fallback")).toBe(
      "Local fallback",
    );
    expect(draftAiStatusLabel(true, "stale", "fallback")).toContain(
      "refreshing",
    );
  });

  it("describes completed work instead of advancing on a timer", () => {
    expect(draftAiProgressLabel("local_ready", 8)).toBe("8 candidates scored");
    expect(draftAiProgressLabel("checking_context", 8)).toContain(
      "Sleeper player context",
    );
    expect(draftAiProgressLabel("starting_ai", 8)).toContain("Starting");
    expect(draftAiProgressLabel("synthesizing", 8)).toContain("running");
    expect(draftAiProgressLabel("ready", 8)).toBe("Ready for your pick");
  });

  it("does not let slow optional context block AI preparation", async () => {
    const never = new Promise<string>(() => undefined);
    await expect(settleWithin([never], 5)).resolves.toEqual([]);
  });
});
