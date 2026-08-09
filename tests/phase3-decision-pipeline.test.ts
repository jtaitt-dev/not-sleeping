import type { ZodType } from "zod";
import { describe, expect, it, vi } from "vitest";

import { AiProviderRegistry } from "@/providers/ai/provider-registry";
import {
  anthropicModelCapability,
  openAIModelCapability,
} from "@/providers/ai/capabilities";
import type {
  AiProvider,
  AiStructuredRequest,
  AiStructuredResult,
} from "@/providers/ai/types";
import { DecisionPipeline } from "@/services/decision-pipeline/decision-pipeline";
import {
  evidenceChanged,
  playerEvidenceFingerprint,
} from "@/services/evidence/evidence-freshness";
import { evaluateDeterministicDecision } from "@/services/intelligence/deterministic-engine";
import { nextPickSurvivalProbability } from "@/services/scenarios/next-pick-survival";
import { DEFAULT_SETTINGS } from "@/services/storage/settings";
import type { Player } from "@/types/domain";

const input = {
  feature: "draft" as const,
  subject: "draft-1",
  contextSummary: "Pick 1.03 in a 12-team superflex league.",
  strategy: "balanced" as const,
  riskTolerance: 0.5,
  currentPick: 3,
  picksUntilNext: 20,
  candidates: [
    {
      id: "valid-qb",
      label: "Valid QB",
      position: "QB",
      baseValue: 88,
      adp: 4,
      available: true,
      eligible: true,
    },
    {
      id: "already-picked",
      label: "Already Picked RB",
      position: "RB",
      baseValue: 99,
      available: true,
      alreadySelected: true,
    },
    {
      id: "ineligible",
      label: "Ineligible WR",
      position: "WR",
      baseValue: 97,
      eligible: false,
    },
    {
      id: "valid-wr",
      label: "Valid WR",
      position: "WR",
      baseValue: 70,
      available: true,
      eligible: true,
    },
  ],
};

describe("Phase 3 realtime decision architecture", () => {
  it("returns a valid deterministic answer and rejects invalid picks", () => {
    const result = evaluateDeterministicDecision(input, 1_000);
    expect(result.recommendationId).toBe("valid-qb");
    expect(result.rejectedCandidateIds).toEqual([
      "already-picked",
      "ineligible",
    ]);
    expect(result.ranked.every((candidate) => candidate.legal)).toBe(true);
    expect(result.ranked[0]?.nextPickSurvival).toBeGreaterThanOrEqual(0);
    expect(result.ranked[0]?.nextPickSurvival).toBeLessThanOrEqual(1);
  });

  it("is deterministic for next-pick survival simulation", () => {
    const scenario = {
      candidateId: "player-1",
      position: "WR",
      adp: 17,
      currentPick: 10,
      picksUntilNext: 12,
      simulations: 500,
    };
    expect(nextPickSurvivalProbability(scenario)).toBe(
      nextPickSurvivalProbability(scenario),
    );
  });

  it("returns baseline immediately and bounds invalid AI recommendations", async () => {
    const provider = fakeProvider({
      recommendationId: "already-picked",
      summary: "AI attempted an invalid choice.",
      adjustment: 4,
      confidenceDelta: 0.1,
      reasons: ["Contextual note"],
      risks: ["Availability changed"],
    });
    const pipeline = new DecisionPipeline(
      new AiProviderRegistry([provider]),
      async () => DEFAULT_SETTINGS,
      undefined,
      () => 2_000,
    );
    const initial = pipeline.start(input);
    expect(initial.baseline.recommendationId).toBe("valid-qb");
    expect(initial.aiStatus).toBe("queued");
    await vi.waitFor(() => {
      expect(pipeline.get(initial.jobId)?.aiStatus).toBe("ready");
    });
    const complete = pipeline.get(initial.jobId);
    expect(complete?.overlay?.recommendationId).toBe("valid-qb");
    expect(complete?.overlay?.warnings.join(" ")).toContain("invalid");
  });

  it("invalidates evidence when Sleeper metadata changes", () => {
    const player: Player = {
      id: "p1",
      firstName: "Night",
      lastName: "Owl",
      fullName: "Night Owl",
      normalizedName: "night owl",
      position: "WR",
      status: "active",
      newsUpdatedAt: 1000,
      fantasyPositions: ["WR"],
    };
    const before = playerEvidenceFingerprint(player);
    const after = playerEvidenceFingerprint({
      ...player,
      injuryStatus: "Questionable",
      newsUpdatedAt: 2_000,
    });
    expect(evidenceChanged(before, after)).toBe(true);
    expect(evidenceChanged(after, after)).toBe(false);
  });

  it("keeps the deterministic result when consensus providers disagree", async () => {
    const requestedModels: string[] = [];
    const openai = fakeProvider(
      {
        recommendationId: "valid-qb",
        summary: "OpenAI prefers the quarterback.",
        adjustment: 3,
        confidenceDelta: 0.05,
        reasons: ["Quarterback scarcity"],
        risks: [],
      },
      "openai",
      requestedModels,
    );
    const anthropic = fakeProvider(
      {
        recommendationId: "valid-wr",
        summary: "Anthropic prefers the receiver.",
        adjustment: -2,
        confidenceDelta: -0.02,
        reasons: ["Receiver depth"],
        risks: ["Provider disagreement"],
      },
      "anthropic",
      requestedModels,
    );
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.aiDefaults.routingMode = "consensus";
    settings.aiDefaults.consensusModels = {
      openai: "gpt-user-selected-openai",
      anthropic: "claude-user-selected-anthropic",
    };
    const pipeline = new DecisionPipeline(
      new AiProviderRegistry([openai, anthropic]),
      async () => settings,
    );
    const initial = pipeline.start(input);
    await vi.waitFor(() => {
      expect(pipeline.get(initial.jobId)?.aiStatus).toBe("ready");
    });
    const overlay = pipeline.get(initial.jobId)?.overlay;
    expect(overlay).toMatchObject({
      provider: "consensus",
      recommendationId: "valid-qb",
    });
    expect(overlay?.warnings.join(" ")).toContain("disagreement");
    expect(requestedModels).toEqual([
      "gpt-user-selected-openai",
      "claude-user-selected-anthropic",
    ]);
  });

  it("falls back to Luna before an unavailable stored model is requested", async () => {
    const requestedModels: string[] = [];
    const provider = fakeProvider(
      {
        recommendationId: "valid-qb",
        summary: "Luna kept the legal baseline.",
        adjustment: 0,
        confidenceDelta: 0,
        reasons: ["Verified candidate pool"],
        risks: [],
      },
      "openai",
      requestedModels,
    );
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.aiDefaults.model = "gpt-removed-model";
    const pipeline = new DecisionPipeline(
      new AiProviderRegistry([provider]),
      async () => settings,
    );
    const initial = pipeline.start(input);
    await vi.waitFor(() => {
      expect(pipeline.get(initial.jobId)?.aiStatus).toBe("ready");
    });
    expect(requestedModels).toEqual(["gpt-5.6-luna"]);
    expect(pipeline.get(initial.jobId)?.overlay?.warnings.join(" ")).toContain(
      "unavailable",
    );
  });
});

function fakeProvider(
  output: unknown,
  id: AiProvider["id"] = "openai",
  requestedModels?: string[],
): AiProvider {
  return {
    id,
    async testKey() {
      return { ok: true, modelCount: 1 };
    },
    async listModels() {
      return id === "openai"
        ? [
            openAIModelCapability("gpt-5.6-luna"),
            openAIModelCapability("gpt-user-selected-openai"),
          ]
        : [anthropicModelCapability("claude-user-selected-anthropic")];
    },
    async createStructured<T>(
      request: AiStructuredRequest<T>,
    ): Promise<AiStructuredResult<T>> {
      requestedModels?.push(request.model);
      const data = (request.schema as ZodType<T>).parse(output);
      return {
        data,
        responseId: "response-1",
        resolvedModel: request.model,
        provider: id,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        citationUrls: [],
        warnings: [],
      };
    },
  };
}
