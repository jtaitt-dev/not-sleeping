import { describe, expect, it } from "vitest";

import { AiProviderRegistry } from "@/providers/ai/provider-registry";
import type { AiProvider } from "@/providers/ai/types";
import { DecisionPipeline } from "@/services/decision-pipeline/decision-pipeline";
import type { DecisionInput } from "@/services/intelligence/types";
import { DEFAULT_SETTINGS } from "@/services/storage/settings";

// Routing is off, so start() never reaches a provider and each call is a pure
// bookkeeping insert — exactly the path a live draft hammers.
const OFFLINE_SETTINGS = {
  ...DEFAULT_SETTINGS,
  aiDefaults: { ...DEFAULT_SETTINGS.aiDefaults, routingMode: "off" as const },
};

const unusedProvider = {
  id: "openai",
  testKey: async () => ({ ok: true as const, modelCount: 0 }),
  listModels: async () => [],
  createStructured: async () => {
    throw new Error("provider must not be called when routing is off");
  },
} as unknown as AiProvider;

function decisionInput(subject: string): DecisionInput {
  return {
    feature: "draft",
    subject,
    contextSummary: "Live draft pick.",
    strategy: "balanced",
    riskTolerance: 0.5,
    currentPick: 3,
    picksUntilNext: 20,
    candidates: [
      {
        id: "qb-1",
        label: "Some QB",
        position: "QB",
        baseValue: 88,
        available: true,
        eligible: true,
      },
    ],
  };
}

describe("DecisionPipeline bounds its in-memory job tracking", () => {
  it("keeps recent jobs pollable while discarding far older ones", () => {
    const pipeline = new DecisionPipeline(
      new AiProviderRegistry([unusedProvider]),
      async () => OFFLINE_SETTINGS,
    );

    // Roughly a full draft's worth of decisions, each with a distinct subject.
    const jobIds = Array.from({ length: 300 }, (_, index) =>
      pipeline.start(decisionInput(`pick-${index}`)),
    ).map((decision) => decision.jobId);

    const mostRecent = jobIds.at(-1);
    expect(mostRecent).toBeDefined();
    expect(pipeline.get(mostRecent!)).not.toBeNull();

    const retained = jobIds.filter((id) => pipeline.get(id) !== null).length;
    expect(retained).toBeLessThan(jobIds.length);
    expect(retained).toBeGreaterThan(0);
  });

  it("clear() still empties everything", () => {
    const pipeline = new DecisionPipeline(
      new AiProviderRegistry([unusedProvider]),
      async () => OFFLINE_SETTINGS,
    );
    const decision = pipeline.start(decisionInput("pick-1"));
    expect(pipeline.get(decision.jobId)).not.toBeNull();
    pipeline.clear();
    expect(pipeline.get(decision.jobId)).toBeNull();
  });
});
