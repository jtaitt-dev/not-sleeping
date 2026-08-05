import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { AnthropicProvider } from "@/providers/ai/anthropic/anthropic-provider";
import { anthropicModelCapability } from "@/providers/ai/capabilities";
import { DEFAULT_SETTINGS } from "@/services/storage/settings";
import type { AiThinkingMode } from "@/types/domain";

function messageResponse(): Response {
  return new Response(
    JSON.stringify({
      id: "msg_1",
      content: [{ type: "text", text: JSON.stringify({ verdict: "hold" }) }],
      usage: { input_tokens: 8, output_tokens: 3 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** Captures the JSON request bodies the provider actually puts on the wire. */
function recordingProvider() {
  const bodies: Record<string, unknown>[] = [];
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return messageResponse();
  });
  const provider = new AnthropicProvider({
    getKey: async () => "sk-ant-abcdefghijklmnop",
    getSettings: async () => DEFAULT_SETTINGS,
    fetcher: fetcher as unknown as typeof fetch,
  });
  return { provider, bodies };
}

async function requestWithThinking(
  model: string,
  thinkingMode: AiThinkingMode,
) {
  const { provider, bodies } = recordingProvider();
  await provider.createStructured({
    model,
    schemaName: "test_contract",
    schema: z.object({ verdict: z.literal("hold") }),
    system: "Return the contract.",
    input: "Evaluate.",
    useWebSearch: false,
    thinkingMode,
    maxOutputTokens: 4_096,
  });
  return bodies[0] ?? {};
}

// Models on which `thinking: {type:"enabled", budget_tokens: N}` was removed and
// returns HTTP 400. Adaptive thinking is the only supported on-mode.
const ADAPTIVE_ONLY_MODELS = [
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-fable-5",
];

// Models that predate adaptive thinking and still take a token budget.
const LEGACY_BUDGET_MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-1",
];

describe("Anthropic capabilities track current models", () => {
  it.each(ADAPTIVE_ONLY_MODELS)("advertises adaptive thinking for %s", (id) => {
    expect(anthropicModelCapability(id).thinkingModes).toContain("adaptive");
  });

  it.each(ADAPTIVE_ONLY_MODELS)(
    "does not advertise budget-token thinking for %s",
    (id) => {
      expect(anthropicModelCapability(id).thinkingModes).not.toContain(
        "enabled",
      );
    },
  );

  it.each(LEGACY_BUDGET_MODELS)(
    "keeps budget-token thinking available for %s",
    (id) => {
      expect(anthropicModelCapability(id).thinkingModes).toContain("enabled");
    },
  );

  it("offers xhigh effort only where it exists", () => {
    expect(
      anthropicModelCapability("claude-opus-5").reasoningEfforts,
    ).toContain("xhigh");
    expect(
      anthropicModelCapability("claude-opus-4-6").reasoningEfforts,
    ).not.toContain("xhigh");
    expect(
      anthropicModelCapability("claude-haiku-4-5").reasoningEfforts,
    ).toEqual([]);
  });
});

describe("Anthropic request bodies stay valid for current models", () => {
  it.each(ADAPTIVE_ONLY_MODELS)(
    "sends adaptive thinking and never budget_tokens for %s",
    async (model) => {
      const body = await requestWithThinking(model, "adaptive");
      expect(body["thinking"]).toEqual({ type: "adaptive" });
      expect(JSON.stringify(body)).not.toContain("budget_tokens");
    },
  );

  it.each(ADAPTIVE_ONLY_MODELS)(
    "coerces a legacy 'enabled' thinking request to adaptive for %s",
    async (model) => {
      // A persisted setting may still name the removed mode. Substituting is
      // required: sending it produces an HTTP 400 rather than a degraded answer.
      const body = await requestWithThinking(model, "enabled");
      expect(body["thinking"]).toEqual({ type: "adaptive" });
      expect(JSON.stringify(body)).not.toContain("budget_tokens");
    },
  );

  it("still sends a token budget for a legacy model", async () => {
    const body = await requestWithThinking("claude-opus-4-5", "enabled");
    expect(body["thinking"]).toMatchObject({ type: "enabled" });
    expect(JSON.stringify(body)).toContain("budget_tokens");
  });

  it("omits thinking entirely when the caller asks for off", async () => {
    const body = await requestWithThinking("claude-opus-5", "off");
    expect(body).not.toHaveProperty("thinking");
  });
});
